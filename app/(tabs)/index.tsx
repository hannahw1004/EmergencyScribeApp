import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';  // Importing icons from Expo

//import { mapTextToFeatures } from './features';
//import { analyzePatient } from './endlessmedical';
import { SymptomDetector } from './symptom';

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

  const startStopRecording = async () => {
    if (recording) {
      // Stop recording
      await stopRecording();
    } else {
      // Start recording
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
    
        const symptom = new SymptomDetector()
        const summary = await symptom.detectSymptom(transcript);
        console.log(summary)
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
      setStatus('Error stopping recording');
    }
  };

  const uploadAudio = async (audioUri: string) => {
    try {
      const uploadResponse = await FileSystem.uploadAsync(
        'https://api.assemblyai.com/v2/upload',
        audioUri, 
        {
          headers: {
            Authorization: API_KEY,
          },
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        }
      );

      const responseData = JSON.parse(uploadResponse.body);
      return responseData.upload_url; 
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    try {
      const uploadUrl = await uploadAudio(audioUri);
      if (!uploadUrl) throw new Error("Upload failed");

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

        if (response.data.status === "completed") {
          return response.data.text; 
        } else if (response.data.status === "failed") {
          throw new Error("Transcription failed");
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); 
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

        {/* Toggle button for mic/stop */}
        <TouchableOpacity style={styles.roundButton} onPress={startStopRecording} disabled={status === 'Processing transcription...'}>
          <Ionicons name={recording ? "stop" : "mic"} size={50} color="white" />
        </TouchableOpacity>

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
  roundButton: {
    backgroundColor: '#FF4D4D', 
    padding: 20, 
    borderRadius: 50, 
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: { fontSize: 18, textAlign: 'center', marginTop: 10 },
  transcriptionContainer: { marginTop: 20, padding: 10, backgroundColor: '#f8f8f8' },
  transcriptionTitle: { fontSize: 16, fontWeight: 'bold' },
  transcription: { fontSize: 14, color: 'black' },
});

export default EmergencyCallScreen;
