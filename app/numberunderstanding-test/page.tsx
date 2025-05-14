"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import { motion, AnimatePresence } from "framer-motion";

const NumberUnderstanding = () => {
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [timer, setTimer] = useState<number>(0);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [testStarted, setTestStarted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { data: session, status } = useSession();

 
  const fetchQuestion = async () => {
    const res = await fetch("http://127.0.0.1:8000/numberunderstanding_test/getQuestions");
    const data = await res.json();
    setCurrentQuestion(data);
    setStartTime(Date.now());
    setPrediction(null);
    setTimer(0);
  };

  useEffect(() => {
    if (disclaimerAccepted && !testStarted) setTestStarted(true);
  }, [disclaimerAccepted]);

  useEffect(() => {
    if (testStarted) fetchQuestion();
  }, [testStarted]);

  useEffect(() => {
    if (testStarted) {
      const interval = setInterval(() => {
        setTimer(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, testStarted]);

  const handlePredict = async (userChoice: "left" | "right") => {
    const isCorrect = userChoice === currentQuestion.correct_answer ? 1 : 0;
    const payload = {
      left_number: currentQuestion.left_number,
      right_number: currentQuestion.right_number,
      response_time_sec: timer,
      user_correct: isCorrect,
    };

    const res = await fetch("http://127.0.0.1:8000/numberunderstanding_test/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    const updated = [
      ...attempts,
      {
        question: `${currentQuestion.left_number} vs ${currentQuestion.right_number}`,
        isCorrect,
        responseTime: timer,
        result: result.result,
        confidence: result.confidence,
        speed: result.speed_category,
      },
    ];

    setAttempts(updated);
    setPrediction(`${result.result} - (${result.speed_message})`);

    // Save the result to the child's profile
    try {
      await fetch("/api/auth/account/save-test-result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentId: (session?.user as any)?.id,
          testResult: {
        testName: "Number Understanding Test - Dyscalculia",
        result: {
          question: `${currentQuestion.left_number} vs ${currentQuestion.right_number}`,
          isCorrect,
          responseTime: timer,
          result: result.result,
          confidence: result.confidence,
          speed: result.speed_category,
        },
        date: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      console.error("Failed to save test result:", error);
    }

    if (updated.length >= 5) {
      setLoadingSummary(true);
      setTimeout(() => {
        setLoadingSummary(false);
        setShowSummary(true);
      }, 4000);
    } else {
      setTimeout(fetchQuestion, 1500);
    }
  };
  const handlePrint = () => printRef.current && window.print();
  const progressPercent = (attempts.length / 5) * 100;

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-neutral-800 flex flex-col print:bg-white print:text-black">
    

      {!disclaimerAccepted && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-md text-center">
            <h2 className="text-2xl font-semibold mb-4">Disclaimer</h2>
            <p className="text-sm text-neutral-600 mb-5">
              This tool assists in screening for potential Dyscalculia indicators. It is not a diagnostic tool.
              Consult a professional for official evaluation.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setDisclaimerAccepted(true)}
                className="px-4 py-2 bg-black text-white rounded hover:opacity-90"
              >
                Agree
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-neutral-300 rounded hover:bg-neutral-100"
              >
                Disagree
              </button>
            </div>
          </div>
        </div>
      )}

      <main className={`flex-1 pt-20 transition-opacity duration-300 ${!disclaimerAccepted && "opacity-20 pointer-events-none"}`}>
        <div ref={printRef} className="max-w-3xl mx-auto px-4 pb-20 py-28">
          <div className="bg-white border border-neutral-200 shadow-lg rounded-3xl p-10 print:border-0 print:shadow-none">
            <h1 className="text-3xl font-semibold mb-8 text-center text-black">Number Understanding Test</h1>

            <div className="mb-6 text-sm text-yellow-700 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              ⚠️ This is a screening tool, not a diagnostic tool. Always consult a professional for official assessment.
            </div>

            <div className="mb-6">
              <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-black transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-center mt-2 text-neutral-500">{attempts.length}/5 completed</p>
            </div>

            {!showSummary && !loadingSummary && currentQuestion && (
              <>
                <p className="text-center text-sm text-neutral-500 mb-4">
                  {currentQuestion.question_type}
                </p>
                <div className="flex gap-4 mb-4">
                  <button
                    onClick={() => handlePredict("left")}
                    className="flex-1 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-100 text-lg font-medium transition"
                  >
                    {currentQuestion.left_number}
                  </button>
                  <button
                    onClick={() => handlePredict("right")}
                    className="flex-1 py-3 border border-neutral-300 rounded-lg hover:bg-neutral-100 text-lg font-medium transition"
                  >
                    {currentQuestion.right_number}
                  </button>
                </div>
                <p className="text-center text-xs text-neutral-400 mb-3">Time: {timer}s</p>

                {prediction && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-sm font-medium text-emerald-600"
                  >
                    {prediction}
                  </motion.div>
                )}
              </>
            )}

            {loadingSummary && (
              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center mt-6"
                >
                  <p className="text-sm text-neutral-500 mb-2">Analyzing results...</p>
                  <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-black rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 4, ease: "linear" }}
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            )}

            {showSummary && (
              <div className="mt-6 bg-green-50 p-6 rounded-2xl text-sm print:bg-white print:text-black">
                <h3 className="text-lg font-semibold mb-3">Summary</h3>
                <ul className="space-y-2 mb-3">
                  {attempts.map((a, i) => (
                    <li key={i}>
                      <strong>Q{i + 1}</strong>: {a.question} →
                      <span className={`ml-1 font-medium ${a.isCorrect ? "text-green-600" : "text-red-500"}`}>
                        {a.isCorrect ? "Correct" : "Incorrect"}
                      </span>{" "}
                      ({a.responseTime}s, {a.speed})
                    </li>
                  ))}
                </ul>
                <p><strong>Total:</strong> {attempts.length}</p>
                <p><strong>Correct:</strong> {attempts.filter(a => a.isCorrect).length}</p>
                <p><strong>Avg Time:</strong> {(attempts.reduce((sum, a) => sum + a.responseTime, 0) / attempts.length).toFixed(2)}s</p>
                <p><strong>Final Prediction:</strong> {attempts.at(-1)?.result}</p>

                <button
                  onClick={handlePrint}
                  className="mt-4 px-4 py-2 bg-black text-white rounded-lg hover:opacity-90 transition print:hidden"
                >
                  Print Result
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
      <div className="text-xs text-center text-neutral-500 px-4 pb-6">
        <p>
          Disclaimer: This screening tool is intended for preliminary guidance only and is not a substitute for professional diagnosis.
          If you have concerns about dyscalculia or related conditions, please consult a qualified healthcare or educational professional.
        </p>
      </div>
    
    </div>
  );
};

export default NumberUnderstanding;
