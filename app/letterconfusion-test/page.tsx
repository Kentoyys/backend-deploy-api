"use client";
import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const MAX_ATTEMPTS = 5;

const LetterConfusion = () => {
 const getIndicatorLabel = (confidence: number | null) => {
  if (confidence === null) return "Unknown";
  if (confidence < 0.4) return "Minimal Indicators";
  if (confidence < 0.7) return "Emerging Indicators";
  return "Strong Indicators";
};

  const { data: session } = useSession();
  const router = useRouter();

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(null);
  const [testStarted, setTestStarted] = useState<boolean>(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [childName, setChildName] = useState<string>("");

  // Fetch child data
  useEffect(() => {
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
        if (child) setChildName(child.name);
      }
    };

    if (session) fetchChildData();
  }, [session]);

  // Load questions
  useEffect(() => {
    const loadQuestions = async () => {
      const res = await fetch("/questions/letter_confusion.json");
      const data = await res.json();
      setQuestions(data);
    };
    loadQuestions();
  }, []);

  // Timer
  useEffect(() => {
    if (!testStarted || questionStartTime === null) return;
    const timer = setInterval(() => {
      setElapsedTime(Date.now() - questionStartTime);
    }, 100);
    return () => clearInterval(timer);
  }, [questionStartTime, testStarted]);

  const currentQuestion = questions[currentIndex];

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    if (!testStarted) {
      setTestStarted(true);
      setQuestionStartTime(Date.now());
    }
  };

  const mapQuestionType = (type: string) => {
    const types: any = {
      "Matching Task": "matching",
      "Same/Different Task": "same_different",
    };
    return types[type] || "unknown";
  };

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentQuestion) return;
    const responseTime = Date.now() - (questionStartTime ?? Date.now());

    const answer = {
      question_type: mapQuestionType(currentQuestion.question_type),
      shown_letters: currentQuestion.options,
      correct: selectedAnswer === currentQuestion.answer ? 1 : 0,
      response_time_ms: responseTime,
    };

    const updatedAnswers = [...answers, answer];
    setAnswers(updatedAnswers);
    setSelectedAnswer(null);
    setElapsedTime(0);
    setQuestionStartTime(Date.now());

    if (updatedAnswers.length >= MAX_ATTEMPTS || currentIndex + 1 >= questions.length) {
      // Final step: Submit answers
      setLoading(true);
      try {
        const res = await fetch("http://127.0.0.1:8000/letterconfusion_test/dyslexia/submit_answer/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedAnswers),
        });

        const data = await res.json();
        setPrediction(data.prediction);
        setConfidence(data.confidence);
        setShowSummary(true);

        // Save result
        await fetch("/api/auth/account/save-test-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId: session?.user?.email, // Using email instead of id since id doesn't exist
            childName,
            testResult: {
              testName: "Letter Confusion Test - Dyslexia",
              result: {
                prediction: data.prediction,
                confidence: data.confidence,
                answers: updatedAnswers,
              },
            },
          }),
        });
      } catch (err) {
        console.error("Error:", err);
      } finally {
        setLoading(false);
      }
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <>
     
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-white">
        <div className="w-full max-w-2xl p-6 bg-white rounded-2xl shadow-md">
          <header className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Letter Confusion Test</h1>
            <p className="text-sm text-gray-500">You’ll answer 5 questions before results are shown.</p>
          </header>

          {showSummary ? (
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold text-gray-700">Summary</h2>
              <ul className="text-left text-sm text-gray-600 space-y-2">
                {answers.map((a, idx) => (
                  <li key={idx}>
                    <strong>Q{idx + 1}</strong> - Correct: {a.correct ? "Yes" : "No"} | Time: {(a.response_time_ms / 1000).toFixed(2)}s
                  </li>
                ))}
              </ul>
              <p className="text-lg font-medium text-gray-800">
                <span className="block mt-2">Prediction: <strong>{prediction}</strong></span>
                <span>Confidence: <strong>{(confidence! * 100).toFixed(2)}%</strong></span>
                <span className="block mt-2 text-sm text-gray-600">
                  Indicator: <strong>{getIndicatorLabel(confidence)}</strong>
                </span>
              </p>
              <button
                onClick={() => router.push("/account/child-account/child-profile")}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                View in Profile
              </button>
            </div>
          ) : currentQuestion ? (
            // rest of the question block...

            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg text-gray-700 mb-2">{currentQuestion.question}</h2>
                <p className="text-xs text-gray-400">Time: {(elapsedTime / 1000).toFixed(1)} sec</p>
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {currentQuestion.question_type === "Matching Task" &&
                  currentQuestion.options.map((option: string, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleAnswerSelect(option)}
                      className={`w-14 h-14 text-lg rounded-lg border transition 
                        ${selectedAnswer === option
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"}`}
                    >
                      {option}
                    </button>
                  ))}

                {currentQuestion.question_type === "Same/Different Task" && (
                  <>
                    <div className="flex justify-center gap-4 text-2xl text-gray-700">
                      <span>{currentQuestion.options[0]}</span>
                      <span>vs</span>
                      <span>{currentQuestion.options[1]}</span>
                    </div>
                    <div className="flex justify-center gap-4">
                      {["same", "different"].map((option) => (
                        <button
                          key={option}
                          onClick={() => handleAnswerSelect(option)}
                          className={`px-4 py-2 rounded-lg border text-sm capitalize transition 
                            ${selectedAnswer === option
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"}`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="text-center">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={!selectedAnswer || loading}
                  className={`px-5 py-2 rounded-lg text-white transition 
                    ${selectedAnswer && !loading
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-gray-300 cursor-not-allowed"}`}
                >
                  {loading ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-center">Loading question...</p>
          )}
        </div>
      </main>

      <div className="bg-gray-100 py-4 px-6 text-center text-sm text-gray-600">
        <p>
          <strong>Disclaimer:</strong> This tool screens for potential signs of Dyslexia. It is not a diagnostic tool.
        </p>
      </div>
    
    </>
  );
};

export default LetterConfusion;
