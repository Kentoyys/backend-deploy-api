"use client";
import React, { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

type ResultData = {
  user_answer: string;
  correct_word: string;
  is_correct: boolean;
  spelling_incorrect_prob: number;
  spelling_risk: string;
  attempt_number: number;
};

const SpellingTask = () => {

  const router = useRouter();
  const [audioUrl, setAudioUrl] = useState("");
  const [audioFileName, setAudioFileName] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [result, setResult] = useState<ResultData | null>(null);
  const [attempts, setAttempts] = useState<ResultData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [childName, setChildName] = useState<string>("");
  const [childBirthday, setChildBirthday] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<boolean>(false);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [showSummary, setShowSummary] = useState(false);

  const fetchNewAudio = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/spelling_test/get-audio");
      const contentType = res.headers.get("Content-Type");
      if (!res.ok || !contentType?.includes("application/json")) {
        const errorText = await res.text();
        throw new Error(`Unexpected response: ${errorText}`);
      }
      const data = await res.json();
      const audioFileName = data.audio_file.replace("audio/correct/", "");
      setAudioUrl(`http://127.0.0.1:8000/${data.audio_file}`);
      setAudioFileName(data.audio_file.replace("audio/correct/", ""));
      setUserAnswer("");
      setResult(null);
    } catch (err) {
      console.error(err);
      setError("Failed to load audio. Please try again.");
    }
  };

  useEffect(() => {
    fetchNewAudio();
  }, []);

  const handleSubmit = async () => {
    try {
      if (!userAnswer.trim()) {
        setError("Please enter your answer before submitting.");
        return;
      }

      setIsLoading(true);
      setResult(null);
      setSuccessMessage(false);

      const payload = {
        user_answer: userAnswer,
        audio_file: audioFileName,
        attempt_number: currentAttempt,
      };

      const res = await fetch(
        "http://127.0.0.1:8000/spelling_test/validate-answer",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const contentType = res.headers.get("Content-Type");
      if (!res.ok || !contentType?.includes("application/json")) {
        const errorText = await res.text();
        console.error("Server response:", errorText);
        throw new Error(`Unexpected response: ${errorText}`);
      }

      const data = await res.json();
      const resultWithAttempt = { ...data, attempt_number: currentAttempt };
      setResult(resultWithAttempt);
      setAttempts((prev) => [...prev, resultWithAttempt]);
      setIsLoading(false);

      if (currentAttempt < 5) {
        setCurrentAttempt(prev => prev + 1);
        setTimeout(() => {
          fetchNewAudio();
        }, 1500);
      } else {
        setShowSummary(true);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const calculateOverallRisk = () => {
    if (attempts.length === 0) return "No attempts made";
    
    const avgProb = attempts.reduce((sum, attempt) => sum + attempt.spelling_incorrect_prob, 0) / attempts.length;
    
    if (avgProb >= 0.7) return "Strong indicators";
    if (avgProb >= 0.4) return "Emerging indicators";
    return "Minimal indicators";
  };

  return (
    <>
      
      <main className="relative min-h-screen bg-white text-black">
        {/* Banner */}
        <div className="absolute top-0 left-0 w-full h-96">
          <img
            src="/images/bannerimg_dysgraphia.png"
            alt="Banner"
            className="w-full h-full object-cover"
          />
        </div>
        {/* Content */}
        <div className="relative z-10 max-w-5xl mx-auto px-6 pt-96">
          <div className="max-w-lg mx-auto">
            <h2 className="text-2xl font-bold mb-6 py-12">Spelling Task</h2>

            <div className="bg-yellow-100 text-yellow-800 text-sm p-4 rounded mb-6">
              <strong>Important Note:</strong> This tool analyzes user response to indentify potential signs of Dyslexia It is not a diagnostic tool and should.
              not be used as a substitute for professional evaluation or medical advice
            </div>

            <div className="bg-blue-100 text-blue-800 text-sm p-4 rounded mb-6">
              <strong>Instructions:</strong> You will have 5 attempts. For each attempt, listen carefully to the audio provided and type the word exactly as you hear it. Make sure to double-check your spelling before submitting your answer.
            </div>

            {!showSummary ? (
              <>
                <div className="mb-4 text-center">
                  <span className="text-lg font-semibold">Attempt {currentAttempt} of 5</span>
                </div>

                {error && <p className="text-red-600">{error}</p>}

                {audioUrl && (
                  <div className="mb-4">
                    <audio controls src={audioUrl} className="w-full"></audio>
                  </div>
                )}

                <input
                  type="text"
                  className="border border-gray-300 p-3 rounded w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type what you heard..."
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  disabled={isLoading}
                />

                <button
                  onClick={handleSubmit}
                  disabled={!userAnswer.trim() || isLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded mt-4 w-full hover:bg-blue-700 transition disabled:opacity-50"
                >
                  Submit
                </button>

                {isLoading && (
                  <div className="mt-6 flex flex-col items-center">
                    <div className="loader mb-2 w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-700">Analyzing your answer...</p>
                  </div>
                )}

                {result && (
                  <div className="mt-6 bg-gray-50 border border-gray-200 rounded p-4">
                    <h3 className="text-lg font-bold">Result</h3>
                    <p>
                      <strong>Your Answer:</strong> {result.user_answer}
                    </p>
                    <p>
                      <strong>Correct Word:</strong> {result.correct_word}
                    </p>
                    <p>
                      <strong>Accuracy:</strong>{" "}
                      <span
                        className={
                          result.is_correct
                            ? "text-green-600 font-medium"
                            : "text-red-600 font-medium"
                        }
                      >
                        {result.is_correct ? "Correct" : "Incorrect"}
                      </span>
                    </p>
                    <p>
                      <strong>Spelling Risk:</strong> {result.spelling_risk} (Probability: {result.spelling_incorrect_prob})
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-6">
                <h3 className="text-xl font-bold mb-4">Test Summary</h3>
                <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
                  <h4 className="text-lg font-semibold mb-2">Overall Assessment</h4>
                  <p><strong>Overall Risk Level:</strong> {calculateOverallRisk()}</p>
                  <p><strong>Total Correct Answers:</strong> {attempts.filter(a => a.is_correct).length} out of 5</p>
                </div>
                
                <div className="space-y-4">
                  {attempts.map((attempt, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded p-4">
                      <h4 className="font-semibold">Attempt {attempt.attempt_number}</h4>
                      <p><strong>Word:</strong> {attempt.correct_word}</p>
                      <p><strong>Your Answer:</strong> {attempt.user_answer}</p>
                      <p><strong>Result:</strong> <span className={attempt.is_correct ? "text-green-600" : "text-red-600"}>{attempt.is_correct ? "Correct" : "Incorrect"}</span></p>
                      <p><strong>Risk Level:</strong> {attempt.spelling_risk}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push("/account/child-account/child-profile")}
                  className="bg-blue-600 text-white px-4 py-2 rounded mt-6 w-full hover:bg-blue-700 transition"
                >
                  View Full Profile
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
  
    </>
  );
};

export default SpellingTask;