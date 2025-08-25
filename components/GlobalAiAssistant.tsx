import React, { useState, useRef, useEffect } from 'react';
import { User, CornerDownLeft, Loader2, X, Send } from 'lucide-react';
import type { Core, Folder, ChatMessage, AiChatContext, SidebarView } from '../types';
import { createGlobalAiChat, sendGlobalAiChatMessageStream } from '../services/geminiService';
import type { Chat } from '@google/genai';
import Logo from './Logo';

interface GlobalAiAssistantProps {
  selectedCore: Core | null;
  cores: Core[];
  folders: Folder[];
  sidebarView: SidebarView;
}

const GlobalAiAssistant: React.FC<GlobalAiAssistantProps> = ({ selectedCore, cores, folders, sidebarView }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatInstance = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        try {
            chatInstance.current = createGlobalAiChat();
            setMessages([
                { role: 'model', content: "I'm the PaleoAI Research Assistant. Ask me anything about your project." }
            ]);
        } catch (error: any) {
            console.error(error);
            setMessages([
                { role: 'model', content: `The AI assistant could not be initialized: ${error.message}` }
            ]);
        }
    }, []);
    
    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!query.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: query };
        setMessages(prev => [...prev, userMessage]);
        setQuery('');
        setIsLoading(true);

        setMessages(prev => [...prev, { role: 'model', content: '' }]);

        if (!chatInstance.current) {
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                const errorMessage = { ...lastMessage, content: 'Chat is not initialized. Please refresh.' };
                return [...prev.slice(0, -1), errorMessage];
            });
            setIsLoading(false);
            return;
        }

        try {
            const context: AiChatContext = { selectedCore, cores, folders, sidebarView };
            const stream = await sendGlobalAiChatMessageStream(chatInstance.current, userMessage.content, context);
            
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage.role === 'model') {
                        const updatedMessage = {
                            ...lastMessage,
                            content: lastMessage.content + chunkText,
                        };
                        return [...prev.slice(0, -1), updatedMessage];
                    }
                    return prev;
                });
            }
        } catch (error: any) {
            console.error(error);
            setMessages(prev => {
                const lastMessage = prev[prev.length - 1];
                const errorMessage = { ...lastMessage, content: `Sorry, an error occurred: ${error.message}` };
                return [...prev.slice(0, -1), errorMessage];
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 p-4 rounded-full bg-accent-primary text-accent-primary-text shadow-lg hover:bg-accent-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-secondary focus:ring-accent-primary-hover transition-transform transform hover:scale-110"
                title="Open PaleoAI Research Assistant"
                aria-label="Open PaleoAI Research Assistant"
            >
                <Logo size={28} />
            </button>
            
            {isOpen && <div className="ai-assistant-backdrop fixed inset-0 bg-black/60 z-40" onClick={() => setIsOpen(false)} />}
            
            <div className={`ai-assistant-panel fixed top-0 right-0 h-full w-full max-w-lg bg-background-primary z-50 shadow-2xl flex flex-col border-l border-border-primary ${isOpen ? 'ai-assistant-panel-open' : ''}`}>
                <header className="flex items-center justify-between p-4 border-b border-border-primary flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-accent-primary/20">
                           <Logo size={24} className="text-accent-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-content-primary">PaleoAI Research Assistant</h2>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="p-2 text-content-muted hover:text-content-primary rounded-full hover:bg-background-interactive">
                        <X size={20} />
                    </button>
                </header>

                <div className="flex-grow p-4 overflow-y-auto space-y-6">
                     {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 max-w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <div className="p-2 rounded-full bg-accent-primary/20 flex-shrink-0">
                                   <Logo size={20} className="text-accent-primary" />
                                </div>
                            )}
                            <div className={`p-3 rounded-xl max-w-md ${msg.role === 'user' ? 'bg-accent-primary text-accent-primary-text' : 'bg-background-tertiary text-content-secondary'}`}>
                               {msg.content === '' && msg.role === 'model' ? 
                               (
                                    <div className="flex items-center space-x-2">
                                        <Loader2 className="animate-spin text-content-muted" size={16}/>
                                        <span className="text-sm text-content-muted">Thinking...</span>
                                    </div>
                               ) : (
                                   <p className="text-sm prose prose-sm prose-invert max-w-none prose-p:my-1" style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                               )}
                            </div>
                             {msg.role === 'user' && (
                                <div className="p-2 rounded-full bg-background-tertiary flex-shrink-0">
                                   <User size={20} className="text-content-secondary"/>
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <footer className="p-4 border-t border-border-primary flex-shrink-0">
                     <div className="relative">
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="e.g., 'Compare my cores in the Atlantic and Pacific...'"
                            disabled={isLoading}
                            className="w-full bg-background-tertiary border border-border-secondary rounded-lg py-3 pl-4 pr-12 text-content-primary placeholder-content-muted focus:ring-2 focus:ring-accent-primary focus:outline-none transition"
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !query.trim()}
                            className="absolute inset-y-0 right-0 flex items-center justify-center w-12 text-content-muted hover:text-accent-primary disabled:text-content-muted/50 disabled:cursor-not-allowed transition"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default GlobalAiAssistant;