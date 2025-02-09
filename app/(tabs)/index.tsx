import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Switch  } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { SymptomDetector } from './symptom';

const API_KEY = "f3b7e65191df4d849a61b1ca537e2356";

const EmergencyCallScreen = () => {
  const [recordingInstance, setRecordingInstance] = useState<Audio.Recording | null>(null);
  const [recording, setRecording] = useState<boolean>(false);
  const [status, setStatus] = useState('Ready to record');
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isDoctorMode, setIsDoctorMode] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const dummySummary = {
    mainPoints: [
      "Patient reported severe abdominal pain",
      "Symptoms started 3 days ago",
      "Pain intensifies after meals"
    ],
    recommendations: [
      "Schedule immediate follow-up",
      "Avoid spicy foods",
      "Monitor pain patterns"
    ]
  };
  
  useEffect(() => {
    if (recording) {
      startPulseAnimation();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recording]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

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

  const toggleSwitch = () => {
    setIsDoctorMode(previousState => !previousState);
  };


  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.modeText}>{isDoctorMode ? "Doctor Mode" : "Patient Mode"}</Text>
        <Switch
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isDoctorMode ? '#2196F3' : '#f4f3f4'}
          onValueChange={toggleSwitch}
          value={isDoctorMode}
          style={[styles.switch, { zIndex: 10 }]}
        />
      </View>

      <View style={styles.card}>
        {!isDoctorMode ? (
          // Patient Mode
          <>
            <Text style={styles.title}>Emergency Translator</Text>
            <View style={styles.buttonContainer}>
              <Animated.View style={[
                styles.pulsingCircle,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: recording ? 1 : 0,
                }
              ]}>
                <LinearGradient
                  colors={['#FF6B6B', '#FF4D4D', '#FF3333']}
                  style={styles.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </Animated.View>
              <TouchableOpacity 
                style={styles.roundButton} 
                onPress={startStopRecording} 
                disabled={status === 'Processing transcription...'}
              >
                <Ionicons 
                  name={recording ? "stop" : "mic"} 
                  size={50} 
                  color="white" 
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.statusText}>{status}</Text>
            {transcription && (
              <Animated.View style={[styles.transcriptionContainer, { opacity: fadeAnim }]}>
                <Text style={styles.transcriptionTitle}>Transcription:</Text>
                <Text style={styles.transcription}>{transcription}</Text>
              </Animated.View>
            )}
          </>
        ) : (
          // Doctor Mode
          <View style={styles.doctorView}>
            <Text style={styles.doctorTitle}>Patient Summary</Text>
            
            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Main Points</Text>
              <View style={styles.divider} />
              {dummySummary.mainPoints.map((point, index) => (
                <View key={index} style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.pointText}>{point}</Text>
                </View>
              ))}
            </View>

            <View style={styles.summarySection}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              <View style={styles.divider} />
              {dummySummary.recommendations.map((rec, index) => (
                <View key={index} style={styles.bulletPoint}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.pointText}>{rec}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: "center",
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',  // Change this to 'space-between' if needed
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  modeText: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
    color: '#2c3e50',
  },
  switch: {
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  card: {
    flex: 1,
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    justifyContent: "center",
  },
  doctorView: {
    flex: 1,
    padding: 10,
  },
  doctorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 25,
    textAlign: 'center',
  },
  summarySection: {
    marginBottom: 25,
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 10,
  },
  divider: {
    height: 2,
    backgroundColor: '#e9ecef',
    marginBottom: 15,
  },
  bulletPoint: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  bullet: {
    fontSize: 20,
    color: '#2196F3',
    marginRight: 10,
    lineHeight: 24,
  },
  pointText: {
    flex: 1,
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  pulsingCircle: {
    position: 'absolute',
    width: 100,  // Match roundButton size
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    width: 100, // Match roundButton size
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roundButton: {
    backgroundColor: '#A7292F',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statusText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
    color: '#666',
  },
  transcriptionContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  transcriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  transcription: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default EmergencyCallScreen;