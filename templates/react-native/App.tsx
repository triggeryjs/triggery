import { createRuntime } from '@triggery/core';
import { TriggerRuntimeProvider, useAction, useCondition, useEvent } from '@triggery/react';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { welcomeTrigger } from './triggers/welcome.trigger.ts';

const runtime = createRuntime();

export default function App() {
  return (
    <TriggerRuntimeProvider runtime={runtime}>
      <View style={styles.container}>
        <Text style={styles.title}>Triggery + React Native</Text>
        <Text style={styles.body}>
          Tap <Text style={styles.b}>Greet</Text>. With <Text style={styles.b}>Be friendly</Text> on
          you'll see a greeting. Toggle it off, tap again — silence.
        </Text>
        <FriendlinessToggle />
        <GreetButton />
        <GreetingDisplay />
        <StatusBar style="auto" />
      </View>
    </TriggerRuntimeProvider>
  );
}

function FriendlinessToggle() {
  const [friendly, setFriendly] = useState(true);
  useCondition(welcomeTrigger, 'friendly', () => friendly, [friendly]);
  return (
    <View style={styles.row}>
      <Switch value={friendly} onValueChange={setFriendly} />
      <Text style={styles.rowLabel}>Be friendly</Text>
    </View>
  );
}

function GreetButton() {
  const fire = useEvent(welcomeTrigger, 'greet');
  return (
    <Pressable
      style={styles.button}
      onPress={() => fire(new Date().toLocaleTimeString())}
    >
      <Text style={styles.buttonText}>Greet</Text>
    </Pressable>
  );
}

function GreetingDisplay() {
  const [last, setLast] = useState<string | null>(null);
  useAction(welcomeTrigger, 'say', (text) => setLast(text));
  if (!last) return null;
  return (
    <View style={styles.greeting}>
      <Text style={styles.greetingText}>{last}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 20, color: '#333' },
  b: { fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  rowLabel: { marginLeft: 12, fontSize: 14 },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  greeting: {
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bbd',
    backgroundColor: '#eef',
    borderRadius: 8,
  },
  greetingText: { fontSize: 14 },
});
