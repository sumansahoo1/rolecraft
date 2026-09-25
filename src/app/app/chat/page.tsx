'use client';

import { ChatScreen } from '@/components/chat/ChatScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function ChatPage() {
  return (
    <div className="flex h-[calc(100vh)] flex-1 flex-col">
      <ErrorBoundary>
        <ChatScreen />
      </ErrorBoundary>
    </div>
  );
}
