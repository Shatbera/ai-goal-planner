import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// On a real Android device, localhost points to the device itself.
// Replace this with your computer's LAN IP when needed, for example:
// http://192.168.1.10:3000/ai/chat
const API_URL = 'http://localhost:3000/ai/chat';

type PlannerUiType = 'text_input' | 'single_select' | 'multi_select';

type PlannerOption = {
  id: string;
  label: string;
};

type PlannerUi = {
  type: PlannerUiType;
  question: string;
  placeholder?: string;
  options?: PlannerOption[];
  allowCustomAnswer?: boolean;
  minSelected?: number;
  maxSelected?: number;
};

type PlannerResponse = {
  message: string;
  ui: PlannerUi;
  nextPhase: string;
  summaryUpdate?: string;
  readyForPlan: boolean;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type ChatResponse = {
  sessionId: string;
  response?: PlannerResponse;
  message?: string | string[];
};

const INITIAL_PLANNER_RESPONSE: PlannerResponse = {
  message:
    "I can't know the right plan yet. Tell me the goal you want to explore, and we'll start from your real life.",
  ui: {
    type: 'text_input',
    question: 'What goal do you want to work on?',
    placeholder: 'Example: I want to learn AI, change careers, get healthier...',
  },
  nextPhase: 'clarify_real_goal',
  readyForPlan: false,
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'initial-assistant',
    role: 'assistant',
    text: INITIAL_PLANNER_RESPONSE.message,
  },
];

export default function App() {
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [plannerResponse, setPlannerResponse] = useState(INITIAL_PLANNER_RESPONSE);
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [textAnswer, setTextAnswer] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendAnswer(answer: string) {
    const trimmedAnswer = answer.trim();

    if (!trimmedAnswer) {
      setError('Please enter an answer.');
      return;
    }

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: trimmedAnswer,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    clearAnswerState();
    setLoading(true);
    setError('');

    try {
      const result = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, message: trimmedAnswer }),
      });

      const data = (await result.json()) as ChatResponse;

      if (!result.ok) {
        throw new Error(formatApiError(data.message));
      }

      if (!data.response) {
        throw new Error('The server did not return a planner response.');
      }

      const nextPlannerResponse = data.response;

      setSessionId(data.sessionId);
      setPlannerResponse(nextPlannerResponse);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          text: nextPlannerResponse.message,
        },
      ]);
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

  function sendTextAnswer() {
    sendAnswer(textAnswer);
  }

  function sendSingleSelectAnswer(option: PlannerOption) {
    sendAnswer(option.label);
  }

  function sendCustomSingleSelectAnswer() {
    sendAnswer(customAnswer);
  }

  function toggleMultiSelectOption(optionId: string) {
    setError('');
    setSelectedOptionIds((currentIds) => {
      if (currentIds.includes(optionId)) {
        return currentIds.filter((id) => id !== optionId);
      }

      if (
        plannerResponse.ui.maxSelected &&
        currentIds.length >= plannerResponse.ui.maxSelected
      ) {
        setError(`Choose at most ${plannerResponse.ui.maxSelected}.`);
        return currentIds;
      }

      return [...currentIds, optionId];
    });
  }

  function sendMultiSelectAnswer() {
    const options = plannerResponse.ui.options ?? [];
    const selectedLabels = options
      .filter((option) => selectedOptionIds.includes(option.id))
      .map((option) => option.label);
    const trimmedCustomAnswer = customAnswer.trim();
    const answerParts = trimmedCustomAnswer
      ? [...selectedLabels, trimmedCustomAnswer]
      : selectedLabels;
    const answerCount = answerParts.length;
    const minSelected = plannerResponse.ui.minSelected ?? 1;

    if (answerCount < minSelected) {
      setError(`Choose at least ${minSelected}.`);
      return;
    }

    sendAnswer(answerParts.join(', '));
  }

  function startNewChat() {
    setSessionId(undefined);
    setPlannerResponse(INITIAL_PLANNER_RESPONSE);
    setMessages(INITIAL_MESSAGES);
    clearAnswerState();
    setError('');
  }

  function clearAnswerState() {
    setTextAnswer('');
    setCustomAnswer('');
    setSelectedOptionIds([]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Planner</Text>
      <ScrollView style={styles.messages} contentContainerStyle={styles.messageList}>
        {messages.map((chatMessage) => (
          <View
            key={chatMessage.id}
            style={[
              styles.messageBubble,
              chatMessage.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}>
            <Text style={styles.messageRole}>
              {chatMessage.role === 'user' ? 'You' : 'Assistant'}
            </Text>
            <Text>{chatMessage.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.plannerUi}>
        <Text style={styles.question}>{plannerResponse.ui.question}</Text>
        {renderPlannerInput()}
      </View>

      <Button title="New Chat" onPress={startNewChat} disabled={loading} />
      {loading ? <ActivityIndicator style={styles.loading} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <StatusBar style="auto" />
    </View>
  );

  function renderPlannerInput() {
    if (plannerResponse.ui.type === 'text_input') {
      return (
        <>
          <TextInput
            value={textAnswer}
            onChangeText={setTextAnswer}
            placeholder={plannerResponse.ui.placeholder || 'Write your answer'}
            multiline
            style={styles.input}
          />
          <Button title="Send" onPress={sendTextAnswer} disabled={loading} />
        </>
      );
    }

    if (plannerResponse.ui.type === 'single_select') {
      return (
        <>
          <View style={styles.optionList}>
            {(plannerResponse.ui.options ?? []).map((option) => (
              <Pressable
                key={option.id}
                style={styles.optionButton}
                disabled={loading}
                onPress={() => sendSingleSelectAnswer(option)}>
                <Text>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          {plannerResponse.ui.allowCustomAnswer ? (
            <>
              <TextInput
                value={customAnswer}
                onChangeText={setCustomAnswer}
                placeholder={plannerResponse.ui.placeholder || 'Optional custom answer'}
                style={styles.input}
              />
              <Button
                title="Send Custom Answer"
                onPress={sendCustomSingleSelectAnswer}
                disabled={loading}
              />
            </>
          ) : null}
        </>
      );
    }

    return (
      <>
        <View style={styles.optionList}>
          {(plannerResponse.ui.options ?? []).map((option) => {
            const selected = selectedOptionIds.includes(option.id);

            return (
              <Pressable
                key={option.id}
                style={[styles.optionButton, selected && styles.selectedOptionButton]}
                disabled={loading}
                onPress={() => toggleMultiSelectOption(option.id)}>
                <Text>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {plannerResponse.ui.allowCustomAnswer ? (
          <TextInput
            value={customAnswer}
            onChangeText={setCustomAnswer}
            placeholder={plannerResponse.ui.placeholder || 'Optional custom answer'}
            style={styles.input}
          />
        ) : null}
        <Button title="Send" onPress={sendMultiSelectAnswer} disabled={loading} />
      </>
    );
  }
}

function formatApiError(message?: string | string[]): string {
  if (Array.isArray(message)) {
    return message.join('\n');
  }

  return message || 'Request failed.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  messages: {
    flex: 1,
  },
  messageList: {
    gap: 12,
  },
  messageBubble: {
    borderRadius: 6,
    padding: 12,
  },
  userMessage: {
    backgroundColor: '#e8f0fe',
  },
  assistantMessage: {
    backgroundColor: '#f2f2f2',
  },
  messageRole: {
    fontWeight: '600',
    marginBottom: 4,
  },
  plannerUi: {
    gap: 12,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    minHeight: 64,
    borderColor: '#999',
    borderRadius: 6,
    borderWidth: 1,
    padding: 12,
    textAlignVertical: 'top',
  },
  optionList: {
    gap: 8,
  },
  optionButton: {
    borderColor: '#999',
    borderRadius: 6,
    borderWidth: 1,
    padding: 12,
  },
  selectedOptionButton: {
    backgroundColor: '#dfeaff',
    borderColor: '#2f6fed',
  },
  loading: {
    marginTop: 8,
  },
  error: {
    color: '#b00020',
  },
});
