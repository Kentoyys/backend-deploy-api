"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";


declare global {
    interface Window {
        SpeechRecognition: {
            new(): {
                start(): void;
                stop(): void;
                onresult: (event: any) => void;
                onerror: (event: any) => void;
                onend: () => void;
                lang: string;
            };
        };
        webkitSpeechRecognition: typeof window.SpeechRecognition;
    }
}

export default function PhonoSpeech() {
    const { data: session } = useSession();
    const [questions, setQuestions] = useState<{ Question: string }[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<{ Question: string } | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [transcript, setTranscript] = useState<string>("");
    const [result, setResult] = useState<{ prediction: string; confidence: number } | null>(null);
    const [questionIndex, setQuestionIndex] = useState<number>(0);
    const [childName, setChildName] = useState<string>("");
    const [childBirthday, setChildBirthday] = useState<string>("");
    const [showDisclaimer, setShowDisclaimer] = useState<boolean>(false);
    const [audioLevel, setAudioLevel] = useState<number>(0);
    const [recognition, setRecognition] = useState<any>(null);
    const [isPracticeMode, setIsPracticeMode] = useState<boolean>(true);
    const [practiceComplete, setPracticeComplete] = useState<boolean>(false);
    const [showFeedback, setShowFeedback] = useState<boolean>(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string>("");
    const [isContinuousMode, setIsContinuousMode] = useState<boolean>(false);
    const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.7);
    const [attempts, setAttempts] = useState<{ transcript: string; confidence: number }[]>([]);
    const [currentAttempt, setCurrentAttempt] = useState<number>(0);
    const [questionAttempts, setQuestionAttempts] = useState<{ 
        [key: number]: { 
            transcript: string; 
            confidence: number;
            prediction: string;
        }[] 
    }>({});
    const MAX_ATTEMPTS_PER_QUESTION = 3;
    const QUESTIONS_FOR_PREDICTION = 5;
    const [showSummary, setShowSummary] = useState<boolean>(false);
    const [finalPrediction, setFinalPrediction] = useState<{ prediction: string; confidence: number } | null>(null);

    useEffect(() => {
        // Fetch child data
        const fetchChildData = async () => {
            const res = await fetch(`/api/auth/account/children`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "parent-id": (session?.user as any)?.id || "",
                },
            });

            if (res.ok) {
                const data = await res.json();
                const child = data.children[0];
                if (child) {
                    setChildName(child.name);
                    setChildBirthday(new Date(child.birthday).toLocaleDateString());
                }
            }
        };

        fetchChildData();

        // Fetch questions
        fetch("http://127.0.0.1:8000/phonospeech_test/phonospeech/questions")
            .then((res) => res.json())
            .then((data) => {
                if (data.questions?.length > 0) {
                    setQuestions(data.questions);
                    setCurrentQuestion(data.questions[0]);
                } else {
                    setCurrentQuestion(null);
                }
            })
            .catch((error) => console.error("Error fetching questions:", error));
    }, [session]);

    const startRecording = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser.");
            return;
        }

        setIsRecording(true);
        const newRecognition = new SpeechRecognition();
        newRecognition.lang = "en-US";
        // Configure for better short sound detection
        (newRecognition as any).continuous = true; // Enable continuous mode
        (newRecognition as any).interimResults = true; // Get interim results
        (newRecognition as any).maxAlternatives = 3; // Get multiple alternatives
        
        setRecognition(newRecognition);

        // Add audio level monitoring
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            })
            .then(stream => {
                const audioContext = new AudioContext();
                const analyser = audioContext.createAnalyser();
                const microphone = audioContext.createMediaStreamSource(stream);
                microphone.connect(analyser);
                analyser.fftSize = 256;
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                
                const updateLevel = () => {
                    if (isRecording) {
                        analyser.getByteFrequencyData(dataArray);
                        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                        setAudioLevel(average);
                        requestAnimationFrame(updateLevel);
                    }
                };
                updateLevel();
            });
        }

        newRecognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                const confidence = event.results[i][0].confidence;
                
                if (event.results[i].isFinal) {
                    // For short sounds, check alternatives if confidence is low
                    if (transcript.length <= 2 && confidence < confidenceThreshold) {
                        // Check alternatives for better match
                        for (let j = 1; j < event.results[i].length; j++) {
                            const alt = event.results[i][j];
                            if (alt.confidence > confidence) {
                                finalTranscript = alt.transcript;
                                break;
                            }
                        }
                    } else {
                        finalTranscript = transcript;
                    }
                } else {
                    interimTranscript = transcript;
                }
            }

            // Update transcript with the best result
            if (finalTranscript) {
                setTranscript(finalTranscript);
            } else if (interimTranscript) {
                setTranscript(interimTranscript);
            }
        };

        newRecognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            if (event.error === 'no-speech') {
                // Try to restart recognition if no speech detected
                setTimeout(() => {
                    if (isRecording) {
                        newRecognition.start();
                    }
                }, 1000);
            }
            setIsRecording(false);
        };

        newRecognition.onend = () => {
            if (isRecording) {
                // Restart recognition if it ends while still recording
                newRecognition.start();
            } else {
                setIsRecording(false);
                setAudioLevel(0);
            }
        };
        
        newRecognition.start();
    };

    const stopRecording = () => {
        if (recognition) {
            recognition.stop();
            setIsRecording(false);
            setAudioLevel(0);
        }
    };

    const submitResponse = async () => {
        try {
            const response = await fetch("http://127.0.0.1:8000/phonospeech_test/phonospeech/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: currentQuestion?.Question,
                    child_response: transcript,
                }),
            });

            const data = await response.json();
            
            // Add attempt to the current question's attempts
            setQuestionAttempts(prev => ({
                ...prev,
                [questionIndex]: [...(prev[questionIndex] || []), { 
                    transcript, 
                    confidence: data.confidence_score,
                    prediction: data.risk_level
                }]
            }));
            
            setCurrentAttempt(prev => prev + 1);
            
            // Reset transcript after each attempt
            setTranscript("");
            
            // If we've reached max attempts for this question, automatically move to next question
            if (currentAttempt + 1 >= MAX_ATTEMPTS_PER_QUESTION) {
                setTimeout(() => {
                    if (questionIndex < questions.length - 1) {
                        nextQuestion();
                    } else {
                        // Calculate final prediction if we've completed enough questions
                        calculateFinalPrediction();
                    }
                }, 1500); // Give user time to see the last attempt
            }

            setResult({ 
                prediction: data.risk_level, 
                confidence: data.confidence_score 
            });

            // Save the result to the child's profile
            const saveResultResponse = await fetch("/api/auth/account/save-test-result", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    parentId: (session?.user as any)?.id,
                    childName,
                    testResult: {
                        testName: "PhonoSpeech Test - Dyslexia",
                        result: {
                            questionAttempts: questionAttempts,
                            finalPrediction: finalPrediction,
                            date: new Date().toISOString(),
                        },
                    },
                }),
            });

            if (!saveResultResponse.ok) {
                console.error("Failed to save test result.");
            }
        } catch (error) {
            console.error("Error submitting response:", error);
        }
    };

    const calculateWeightedPrediction = (predictions: { prediction: string; confidence: number }[]) => {
        const predictionCounts: { [key: string]: number } = {};
        let totalConfidence = 0;
        
        predictions.forEach(pred => {
            predictionCounts[pred.prediction] = (predictionCounts[pred.prediction] || 0) + pred.confidence;
            totalConfidence += pred.confidence;
        });
        
        let maxCount = 0;
        let finalPrediction = '';
        
        Object.entries(predictionCounts).forEach(([pred, count]) => {
            if (count > maxCount) {
                maxCount = count;
                finalPrediction = pred;
            }
        });
        
        return {
            prediction: finalPrediction,
            confidence: maxCount / totalConfidence
        };
    };

    const calculateFinalPrediction = () => {
        const completedQuestions = Object.entries(questionAttempts)
            .filter(([index]) => parseInt(index) < QUESTIONS_FOR_PREDICTION)
            .map(([_, attempts]) => attempts);

        if (completedQuestions.length >= QUESTIONS_FOR_PREDICTION) {
            const allPredictions = completedQuestions.flatMap(attempts => 
                attempts.map(attempt => ({
                    prediction: attempt.prediction,
                    confidence: attempt.confidence
                }))
            );

            const weightedPrediction = calculateWeightedPrediction(allPredictions);
            setFinalPrediction(weightedPrediction);
            setShowSummary(true);
        }
    };

    const nextQuestion = () => {
        if (questionIndex < questions.length - 1) {
            setQuestionIndex(questionIndex + 1);
            setCurrentQuestion(questions[questionIndex + 1]);
            setTranscript("");
            setResult(null);
            setCurrentAttempt(0);
        }
    };

    const handleDownloadReport = () => {
        const riskLevelDisplay = getRiskLevelDisplay(finalPrediction?.prediction || '');
        
        const reportContent = `
            PhonoSpeech Test Report
            ======================
            Child Name: ${childName}
            Child Birthday: ${childBirthday}
            
            Final Assessment
            ---------------
            Risk Level: ${riskLevelDisplay.text}
            Confidence: ${(finalPrediction?.confidence || 0 * 100).toFixed(1)}%
            
            Detailed Results
            ---------------
            ${Object.entries(questionAttempts).map(([qIndex, attempts]) => `
            Question ${parseInt(qIndex) + 1}: ${questions[parseInt(qIndex)]?.Question}
            ${attempts.map((attempt, index) => `
                Attempt ${index + 1}:
                Response: "${attempt.transcript}"
                Risk Level: ${getRiskLevelDisplay(attempt.prediction).text}
            `).join('\n')}
            `).join('\n')}
            
            Risk Level Distribution
            ----------------------
            ${Object.entries(
                Object.values(questionAttempts)
                    .flatMap(attempts => attempts.map(attempt => attempt.prediction))
                    .reduce((acc, level) => {
                        acc[level] = (acc[level] || 0) + 1;
                        return acc;
                    }, {} as { [key: string]: number })
            ).map(([level, count]) => 
                `${getRiskLevelDisplay(level).text}: ${count} occurrences`
            ).join('\n')}
        `;

        const blob = new Blob([reportContent], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "phonospeech_test_report.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintReport = () => {
        const riskLevelDisplay = getRiskLevelDisplay(finalPrediction?.prediction || '');
        
        const printContent = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1, h2 { text-align: center; }
                        .section { margin-bottom: 20px; }
                        .section h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                        .risk-level { 
                            padding: 10px;
                            border-radius: 5px;
                            margin: 10px 0;
                            text-align: center;
                        }
                        .attempt { margin: 10px 0; padding: 10px; background: #f5f5f5; }
                    </style>
                </head>
                <body>
                    <h1>PhonoSpeech Test Report</h1>
                    
                    <div class="section">
                        <h2>Child Information</h2>
                        <p><strong>Name:</strong> ${childName}</p>
                        <p><strong>Birthday:</strong> ${childBirthday}</p>
                    </div>

                    <div class="section">
                        <h2>Final Assessment</h2>
                        <div class="risk-level" style="background-color: ${riskLevelDisplay.bg.replace('bg-', '#')}">
                            <h3 style="color: ${riskLevelDisplay.color.replace('text-', '#')}">
                                ${riskLevelDisplay.text}
                            </h3>
                            <p>Confidence: ${(finalPrediction?.confidence || 0 * 100).toFixed(1)}%</p>
                        </div>
                    </div>

                    <div class="section">
                        <h2>Detailed Results</h2>
                        ${Object.entries(questionAttempts).map(([qIndex, attempts]) => `
                            <div class="question">
                                <h3>Question ${parseInt(qIndex) + 1}</h3>
                                <p>${questions[parseInt(qIndex)]?.Question}</p>
                                ${attempts.map((attempt, index) => {
                                    const attemptRiskLevel = getRiskLevelDisplay(attempt.prediction);
                                    return `
                                        <div class="attempt">
                                            <p><strong>Attempt ${index + 1}:</strong></p>
                                            <p>Response: "${attempt.transcript}"</p>
                                            <p style="color: ${attemptRiskLevel.color.replace('text-', '#')}">
                                                Risk Level: ${attemptRiskLevel.text}
                                            </p>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </body>
            </html>
        `;

        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.print();
        }
    };

    const handlePracticeComplete = () => {
        setPracticeComplete(true);
        setShowFeedback(true);
        setFeedbackMessage("Great job! You're ready to start the actual test.");
    };

    const getProgressPercentage = () => {
        return ((questionIndex + 1) / questions.length) * 100;
    };

    // Add this new component for sensitivity controls
    const SensitivityControls = () => (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recognition Settings</h3>
            <div className="space-y-2">
                <div>
                    <label className="text-sm text-gray-600">Sensitivity</label>
                    <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={confidenceThreshold}
                        onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                        className="w-full"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>More Strict</span>
                        <span>More Lenient</span>
                    </div>
                </div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="continuousMode"
                        checked={isContinuousMode}
                        onChange={(e) => setIsContinuousMode(e.target.checked)}
                        className="mr-2"
                    />
                    <label htmlFor="continuousMode" className="text-sm text-gray-600">
                        Continuous Mode (better for short sounds)
                    </label>
                </div>
            </div>
        </div>
    );

    // Add this helper function for risk level display
    const getRiskLevelDisplay = (level: string) => {
        const riskLevels = {
            'minimal': { text: 'Minimal Risk', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
            'emerging': { text: 'Emerging Risk', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
            'strong': { text: 'Strong Risk', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' }
        };
        return riskLevels[level as keyof typeof riskLevels] || { text: level, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
    };

    // Update the QuestionSummary component
    const QuestionSummary = () => {
        const riskLevelCounts = Object.values(questionAttempts).flatMap(attempts => 
            attempts.map(attempt => attempt.prediction)
        ).reduce((acc, level) => {
            acc[level] = (acc[level] || 0) + 1;
            return acc;
        }, {} as { [key: string]: number });

        const mostCommonRisk = Object.entries(riskLevelCounts)
            .sort((a, b) => b[1] - a[1])[0][0];

        const riskLevelDisplay = getRiskLevelDisplay(mostCommonRisk);

        return (
            <div className="space-y-6">
                {/* Final Assessment */}
                <div className={`p-8 rounded-lg border ${riskLevelDisplay.border} bg-gray-50`}>
                    <div className="text-center space-y-4">
                        <h2 className="text-2xl font-semibold text-gray-900">Final Assessment</h2>
                        <div className="space-y-2">
                            <p className={`text-3xl font-bold ${riskLevelDisplay.color}`}>
                                {riskLevelDisplay.text}
                            </p>
                            <p className="text-gray-600">
                                Based on {QUESTIONS_FOR_PREDICTION} questions with {MAX_ATTEMPTS_PER_QUESTION} attempts each
                            </p>
                        </div>
                    </div>
                </div>

                {/* Detailed Results */}
                <div className="space-y-4">
                    {Object.entries(questionAttempts).map(([qIndex, attempts]) => (
                        <div key={qIndex} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                Question {parseInt(qIndex) + 1}
                            </h3>
                            <p className="text-gray-600 mb-4">
                                {questions[parseInt(qIndex)]?.Question}
                            </p>
                            <div className="space-y-3">
                                {attempts.map((attempt, index) => {
                                    const attemptRiskLevel = getRiskLevelDisplay(attempt.prediction);
                                    return (
                                        <div key={index} className="bg-white rounded-lg p-4 border border-gray-200">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm text-gray-600">Attempt {index + 1}</span>
                                                <span className={`px-3 py-1 rounded-full text-sm ${attemptRiskLevel.color} ${attemptRiskLevel.bg}`}>
                                                    {attemptRiskLevel.text}
                                                </span>
                                            </div>
                                            <p className="text-gray-900 italic">"{attempt.transcript}"</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Risk Level Distribution */}
                <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Risk Level Distribution</h3>
                    <div className="space-y-3">
                        {Object.entries(riskLevelCounts).map(([level, count]) => {
                            const levelDisplay = getRiskLevelDisplay(level);
                            return (
                                <div key={level} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                                    <span className={`${levelDisplay.color} font-medium`}>{levelDisplay.text}</span>
                                    <span className="text-gray-600">{count} occurrences</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={handleDownloadReport}
                        className="flex-1 bg-black text-white font-medium py-3 px-4 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        Download Report
                    </button>
                    <button
                        onClick={handlePrintReport}
                        className="flex-1 bg-gray-100 text-gray-900 font-medium py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Print Report
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-white text-black">
            <main className="max-w-3xl mx-auto px-4 py-12">
                <div className="space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-4">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
                            PhonoSpeech Test
                        </h1>
                        <p className="text-gray-600 text-sm">
                            Advanced speech recognition for phonological assessment
                        </p>
                    </div>

                    {/* Practice Mode */}
                    {!practiceComplete && (
                        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                            <div className="space-y-4">
                                <h2 className="text-xl font-semibold text-gray-900">Practice Session</h2>
                                <p className="text-gray-600">
                                    Let's practice first! Try saying "Hello, this is a practice test" to get familiar with the speech recognition.
                                </p>
                                <button
                                    onClick={handlePracticeComplete}
                                    className="w-full bg-black text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors"
                                >
                                    Start Practice
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main Test Interface */}
                    {practiceComplete && (
                        <div className="space-y-6">
                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>Progress</span>
                                    <span>{questionIndex + 1} of {QUESTIONS_FOR_PREDICTION}</span>
                                </div>
                                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                                        style={{ width: `${getProgressPercentage()}%` }}
                                    />
                                </div>
                            </div>

                            {/* Current Question */}
                            {questionIndex < QUESTIONS_FOR_PREDICTION ? (
                                <div className="space-y-6">
                                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                        <div className="space-y-4">
                                            <div className="text-center">
                                                <p className="text-xl font-medium text-gray-900 mb-2">
                                                    {currentQuestion?.Question}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Question {questionIndex + 1} • Attempt {currentAttempt + 1} of {MAX_ATTEMPTS_PER_QUESTION}
                                                </p>
                                            </div>

                                            {/* Recording Controls */}
                                            <div className="space-y-4">
                                                <button
                                                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                                                        isRecording 
                                                            ? "bg-red-500 hover:bg-red-600 text-white" 
                                                            : "bg-black text-white hover:bg-gray-800"
                                                    }`}
                                                    onClick={isRecording ? stopRecording : startRecording}
                                                >
                                                    {isRecording ? "Stop Recording" : "Start Recording"}
                                                </button>

                                                {isRecording && (
                                                    <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                        <span>Listening...</span>
                                                    </div>
                                                )}

                                                {transcript && (
                                                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                                                        <p className="text-center text-gray-900">
                                                            <span className="text-gray-600">You said:</span> "{transcript}"
                                                        </p>
                                                    </div>
                                                )}

                                                <button
                                                    className="w-full bg-black hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    onClick={submitResponse}
                                                    disabled={!transcript || currentAttempt >= MAX_ATTEMPTS_PER_QUESTION}
                                                >
                                                    {currentAttempt >= MAX_ATTEMPTS_PER_QUESTION ? "Moving to Next Question..." : "Submit Answer"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sensitivity Controls */}
                                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                                        <h3 className="text-sm font-medium text-gray-900 mb-4">Recognition Settings</h3>
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex justify-between text-sm text-gray-600 mb-2">
                                                    <span>Sensitivity</span>
                                                    <span>{confidenceThreshold.toFixed(1)}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0.1"
                                                    max="1"
                                                    step="0.1"
                                                    value={confidenceThreshold}
                                                    onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                                                    className="w-full accent-black"
                                                />
                                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                                    <span>More Strict</span>
                                                    <span>More Lenient</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id="continuousMode"
                                                    checked={isContinuousMode}
                                                    onChange={(e) => setIsContinuousMode(e.target.checked)}
                                                    className="mr-2 accent-black"
                                                />
                                                <label htmlFor="continuousMode" className="text-sm text-gray-600">
                                                    Continuous Mode (better for short sounds)
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <QuestionSummary />
                            )}
                        </div>
                    )}

                    {/* Disclaimer */}
                    <div className="text-center text-sm text-gray-500">
                        <p>
                            This tool analyzes user responses to identify potential signs of Dyslexia.
                            It is not a diagnostic tool and should not be used as a substitute for professional evaluation.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}