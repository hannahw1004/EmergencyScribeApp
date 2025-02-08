import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { Platform } from 'react-native';

const API_KEY = "f3b7e65191df4d849a61b1ca537e2356"; // Store this securely (e.g., in environment variables)

const EmergencyCallScreen = () => {
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const [status, setStatus] = useState('Ready to record');
  const [transcription, setTranscription] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const requestPermissions = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      setStatus('Permission to access microphone was denied');
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecordingInstance(recording);
      setRecording(true);
      setStatus('Recording...');

      setTimeout(() => {
        stopRecording();
      }, 5000);
    } catch (error) {
      console.error("Error starting recording:", error);
      setStatus('Error starting recording');
    }
  };

  const stopRecording = async () => {
    if (!recordingInstance) return;
  
    try {
      await recordingInstance.stopAndUnloadAsync();
      const uri = recordingInstance.getURI();
      setRecording(false);
      setRecordingInstance(null);
      setStatus('Processing transcription...');
  
      if (uri) {
        const transcript = await transcribeAudio(uri);
        setTranscription(transcript); // Set the transcription here
        setStatus('Recording completed');
        // Fade in the transcription text
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500, // Adjust duration for the fade effect
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setStatus('Error stopping recording');
    }
  };
  
  
  

  const uploadAudio = async (audioUri: string) => {
    // This is for non-web platforms (mobile)
    try {
      console.log('Uploading audio file:', audioUri);
  
      const uploadResponse = await FileSystem.uploadAsync(
        'https://api.assemblyai.com/v2/upload',
        audioUri, // Use the actual recorded URI
        {
          headers: {
            Authorization: API_KEY,
          },
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        }
      );
  
      const responseData = JSON.parse(uploadResponse.body);
      console.log('Upload response:', responseData);
      return responseData.upload_url; // Return the actual upload URL
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };
  

  const transcribeAudio = async (audioUri: string) => {
    try {
      const uploadUrl = await uploadAudio(audioUri);
      if (!uploadUrl) throw new Error("Upload failed");
  
      console.log('Upload successful. URL:', uploadUrl);  // Check the URL
  
      const response = await axios.post('https://api.assemblyai.com/v2/transcript', 
        { audio_url: uploadUrl },
        { headers: { Authorization: API_KEY, 'Content-Type': 'application/json' } }
      );
  
      const transcriptId = response.data.id;
      return pollTranscription(transcriptId);
    } catch (error) {
      console.error("Transcription error:", error);
      return "Transcription failed";
    }
  };
  
  const pollTranscription = async (transcriptId: string) => {
    try {
      while (true) {
        const response = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
          headers: { Authorization: API_KEY },
        });
  
        console.log("Polling response:", response.data); // Log the response to ensure we get the right data
  
        if (response.data.status === "completed") {
          console.log("Transcription completed:", response.data.text); // Check the transcription text
          return response.data.text; // Return the transcribed text
        } else if (response.data.status === "failed") {
          throw new Error("Transcription failed");
        }
  
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      }
    } catch (error) {
      console.error("Polling error:", error);
      return "Transcription polling failed";
    }
  };
  
  
  
  
  

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Emergency Translator</Text>
        <TouchableOpacity style={styles.roundButton} onPress={startRecording} disabled={recording}>
          <Text style={styles.buttonText}>Start Recording</Text>
        </TouchableOpacity>
        {recording && (
          <TouchableOpacity style={styles.stopButton} onPress={stopRecording}>
            <Text style={styles.buttonText}>Stop Recording</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.statusText}>{status}</Text>
      </View>
      {transcription && (
        <Animated.View style={[styles.transcriptionContainer, { opacity: fadeAnim }]}>
          <Text style={styles.transcriptionTitle}>Transcription:</Text>
          <Text style={styles.transcription}>{transcription}</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { width: '80%', padding: 20, backgroundColor: '#fff', borderRadius: 10 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  roundButton: { backgroundColor: '#FF4D4D', padding: 15, borderRadius: 50, marginBottom: 10 },
  stopButton: { backgroundColor: '#4D94FF', padding: 15, borderRadius: 50 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  statusText: { fontSize: 18, textAlign: 'center', marginTop: 10 },
  transcriptionContainer: { marginTop: 20, padding: 10, backgroundColor: '#f8f8f8' },
  transcriptionTitle: { fontSize: 16, fontWeight: 'bold' },
  transcription: { fontSize: 14, color: 'black' },
});

export default EmergencyCallScreen;
