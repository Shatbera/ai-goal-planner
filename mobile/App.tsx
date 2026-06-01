import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// On a real Android device, localhost points to the device itself.
// Replace this with your computer's LAN IP when needed, for example:
// http://192.168.1.10:3000/ai/test
const API_URL = 'http://localhost:3000/ai/test';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendPrompt() {
    const trimmedPrompt = prompt.trim();

    if (!trimmedPrompt) {
      setError('Please enter a prompt.');
      setResponse('');
      return;
    }

    setLoading(true);
    setError('');
    setResponse('');

    try {
      const result = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: trimmedPrompt }),
      });

      const data = (await result.json()) as { response?: string; message?: string };

      if (!result.ok) {
        throw new Error(data.message || 'Request failed.');
      }

      setResponse(data.response || '');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Something went wrong.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>OpenAI Test</Text>
      <TextInput
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Enter a prompt"
        multiline
        style={styles.input}
      />
      <Button title="Send" onPress={sendPrompt} disabled={loading} />
      {loading ? <ActivityIndicator style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {response ? <Text style={styles.response}>{response}</Text> : null}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    minHeight: 120,
    borderColor: '#999',
    borderRadius: 6,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: 'top',
  },
  loading: {
    marginTop: 8,
  },
  error: {
    color: '#b00020',
  },
  response: {
    fontSize: 16,
  },
});
