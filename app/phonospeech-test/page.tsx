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
    const [questions, setQuestions] = useState<string[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState<string>("Loading questions...");
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [transcript, setTranscript] = useState<string>("");
    const [result, setResult] = useState<{ prediction: string; confidence: number } | null>(null);
    const [questionIndex, setQuestionIndex] = useState<number>(0);
    const [childName, setChildName] = useState<string>("");
    const [childBirthday, setChildBirthday] = useState<string>("");
    const [showDisclaimer, setShowDisclaimer] = useState<boolean>(false);

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
        fetch("http://127.0.0.1:8000/phonospeech_test/dyslexia/questions")
            .then((res) => res.json())
            .then((data) => {
                if (data.questions?.length > 0) {
                    setQuestions(data.questions);
                    setCurrentQuestion(data.questions[0]);
                } else {
                    setCurrentQuestion("No questions available");
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
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            setTranscript(event.results[0][0].transcript);
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            setIsRecording(false);
        };

        recognition.onend = () => setIsRecording(false);
        recognition.start();
    };

    const submitResponse = async () => {
        try {
            const response = await fetch("http://127.0.0.1:8000/phonospeech_test/dyslexia/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: currentQuestion, response: transcript }),
            });

            const data = await response.json();
            setResult({ prediction: data.result.prediction, confidence: data.result.confidence });

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
                            question: currentQuestion,
                            response: transcript,
                            prediction: data.result.prediction, // Include prediction
                            confidence: data.result.confidence, // Include confidence
                        },
                        date: new Date().toISOString(),
                    },
                }),
            });

            if (!saveResultResponse.ok) {
                console.error("Failed to save test result.");
            } else {
                console.log("Test result saved successfully.");
            }
        } catch (error) {
            console.error("Error submitting response:", error);
        }
    };

    const nextQuestion = () => {
        if (questionIndex < questions.length - 1) {
            setQuestionIndex(questionIndex + 1);
            setCurrentQuestion(questions[questionIndex + 1]);
            setTranscript("");
            setResult(null);
        }
    };

    const handleDownloadReport = () => {
        const reportContent = `
            General Reading Test Report
            ===========================
            Child Name: ${childName}
            Child Birthday: ${childBirthday}
            --------------------------
            Question: ${currentQuestion}
            Response: ${transcript}
            Result: ${result || "Pending"}
        `;

        const blob = new Blob([reportContent], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "reading_test_report.txt";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrintReport = () => {
        const printContent = `
            <html>
                <head>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h1 { text-align: center; }
                        .report-section { margin-bottom: 20px; }
                        .report-section h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                        .report-section p { margin: 5px 0; }
                    </style>
                </head>
                <body>
                    <h1>General Reading Test Report</h1>
                    <div class="report-section">
                        <h2>Child Information</h2>
                        <p><strong>Name:</strong> ${childName}</p>
                        <p><strong>Birthday:</strong> ${childBirthday}</p>
                    </div>
                    <div class="report-section">
                        <h2>Test Details</h2>
                        <p><strong>Question:</strong> ${currentQuestion}</p>
                        <p><strong>Response:</strong> ${transcript}</p>
                        <p><strong>Result:</strong> ${result || "Pending"}</p>
                    </div>
                </body>
            </html>
        `;

        const printWindow = window.open("", "_blank");
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.print();
        } else {
            alert("Failed to open print window.");
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">


            <main className="flex-grow px-4 py-12 sm:px-6 lg:px-8 flex flex-col items-center">
                <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8 py-36">
                    <h1 className="text-3xl font-bold mb-4 text-center text-blue-600">PhonoSpeech Test</h1>

                    <div className="mb-6 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p><strong>Instructions:</strong></p>
                        <ul className="list-disc list-inside mt-2">
                            <li>This test evaluates pronunciation and phonological processing.</li>
                            <li>Click <strong>"Start Recording"</strong> and clearly say your answer.</li>
                            <li>After speaking, click <strong>"Submit Answer"</strong> to analyze your response.</li>
                            <li>Click <strong>"Next Question"</strong> to proceed to the next item.</li>
                            <li>You can <strong>Download</strong> or <strong>Print</strong> your report anytime.</li>
                        </ul>
                    </div>

                    <div className="mb-4 text-sm text-yellow-700 bg-yellow-100 border border-yellow-300 rounded-lg p-4">
                        <p><strong>Important Note:</strong> This tool analyzes user responses to identify potential signs of Dyslexia.
                            It is not a diagnostic tool and should not be used as a substitute for professional evaluation or medical advice.</p>
                    </div>

                    <p className="text-lg font-medium text-center mb-4">{currentQuestion}</p>

                    <div className="flex flex-col items-center gap-4">
                        <button
                            className={`w-full py-2 px-4 rounded-lg transition ${isRecording ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                                } text-white`}
                            onClick={startRecording}
                            disabled={isRecording}
                        >
                            {isRecording ? "Listening..." : "Start Recording"}
                        </button>

                        {transcript && (
                            <p className="text-center text-gray-700 italic">You said: "{transcript}"</p>
                        )}

                        <button
                            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition"
                            onClick={submitResponse}
                            disabled={!transcript}
                        >
                            Submit Answer
                        </button>

                        {result && (
                            <div className="mt-4">
                                <p>
                                    <span className="font-bold">Prediction:</span> {result.prediction}
                                </p>
                                <p>
                                    <span className="font-bold">Confidence:</span> {(result.confidence * 100).toFixed(2)}%
                                </p>
                            </div>
                        )}


                        <button
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition"
                            onClick={nextQuestion}
                            disabled={questionIndex >= questions.length - 1}
                        >
                            Next Question
                        </button>
                    </div>

                    <div className="mt-6 flex justify-between gap-2">
                        <button
                            onClick={handleDownloadReport}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg transition"
                        >
                            Download Report
                        </button>
                        <button
                            onClick={handlePrintReport}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition"
                        >
                            Print Report
                        </button>
                    </div>
                </div>

                {showDisclaimer && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 px-4">
                        <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full text-center">
                            <h3 className="text-xl font-semibold text-gray-800">Important Disclaimer</h3>
                            <p className="text-gray-600 text-sm mt-3">
                                This analysis is powered by machine learning and may not be 100% accurate.
                                Please consult a professional for a definitive diagnosis.
                            </p>
                            <button
                                className="mt-5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                onClick={() => setShowDisclaimer(false)}
                            >
                                I Understand
                            </button>
                        </div>
                    </div>
                )}
            </main>


        </div>
    );

}