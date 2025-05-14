"use client";
import { useEffect, useState } from "react";

import { useSession } from "next-auth/react";

type Question = {
  op1: number;
  op2: number;
  operation: string;
  correctAnswer: number;
  incorrectAnswer: number;
};

type Attempt = {
  op1: number;
  op2: number;
  operation: string;
  user_choice: number;
  response_time: number;
};

type SummaryResponse = {
  total_correct: number;
  average_time: number | null;
  overall_risk: string;
  speed_category: string;
  risk_count: number;
  total_attempts: number;
};

const Arithmetic = () => {
  const totalAttempts = 5;
  const totalRounds = 3;

  const { data: session } = useSession();
  const [childName, setChildName] = useState("");
  const [introSeen, setIntroSeen] = useState(false);
  const [category, setCategory] = useState("");
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [currentRound, setCurrentRound] = useState(1);
  const [question, setQuestion] = useState<Question | null>(null);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");

  // Fetch child info
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
        if (child) {
          setChildName(child.name);
        }
      }
    };

    if (session) fetchChildData();
  }, [session]);

  useEffect(() => {
    if (currentAttempt <= totalAttempts && category) {
      generateQuestion();
    }
  }, [currentAttempt, category]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (question) {
      timer = setInterval(() => {
        setElapsedTime((Date.now() - startTime) / 1000);
      }, 100);
    }

    return () => clearInterval(timer);
  }, [question, startTime]);

  const generateQuestion = () => {
    const op1 = Math.floor(Math.random() * 10) + 1;
    const op2 = Math.floor(Math.random() * 10) + 1;
    let operation: string;
    let correctAnswer: number;

    switch (category) {
      case "addition":
        operation = "+";
        correctAnswer = op1 + op2;
        break;
      case "subtraction":
        operation = "-";
        correctAnswer = op1 - op2;
        break;
      case "multiplication":
        operation = "*";
        correctAnswer = op1 * op2;
        break;
      case "division":
        operation = "/";
        correctAnswer = parseFloat((op1 / op2).toFixed(2));
        break;
      default:
        operation = "+";
        correctAnswer = op1 + op2;
    }

    let incorrectAnswer = correctAnswer + (Math.random() < 0.5 ? -1 : 1) * (Math.floor(Math.random() * 3) + 1);
    if (category === "division") incorrectAnswer = parseFloat(incorrectAnswer.toFixed(2));

    setQuestion({ op1, op2, operation, correctAnswer, incorrectAnswer });
    setStartTime(Date.now());
    setElapsedTime(0);
  };

  const handleChoice = (choice: number) => {
    if (!question) return;

    const timeTaken = (Date.now() - startTime) / 1000;
    const isCorrect = choice === question.correctAnswer;

    const newAttempt: Attempt = {
      op1: question.op1,
      op2: question.op2,
      operation: question.operation,
      user_choice: isCorrect ? 0 : 1,
      response_time: timeTaken,
    };

    const updatedAttempts = [...attempts, newAttempt];
    setAttempts(updatedAttempts);

    if (currentAttempt >= totalAttempts) {
      if (currentRound < totalRounds) {
        setCurrentRound((prev) => prev + 1);
        setCurrentAttempt(1);
      } else {
        triggerResultAnimation(updatedAttempts);
      }
    } else {
      setCurrentAttempt((prev) => prev + 1);
    }
  };

  const triggerResultAnimation = (finalAttempts: Attempt[]) => {
    setIsLoadingResult(true);
    const stages = ["Computing...", "Finalizing...", "Generating Results..."];
    let index = 0;

    const interval = setInterval(() => {
      setLoadingStage(stages[index]);
      index++;

      if (index >= stages.length) {
        clearInterval(interval);
        setTimeout(() => {
          submitSummary(finalAttempts);
        }, 1000);
      }
    }, 1500);
  };

  const submitSummary = async (allAttempts: Attempt[]) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/arithmetic_test/api/arithmetic/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempts: allAttempts }),
      });

      const data: SummaryResponse = await response.json();
      setSummary(data);
      setIsLoadingResult(false);

      // Save result to backend
      if (session?.user) {
        await fetch("/api/auth/account/save-test-result", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId: session.user.email, // Using email instead of id since id doesn't exist
            childName: childName,
            testResult: {
              testName: "Arithmetic Test - Dyscalculia", 
              result: { ...data, attempts: allAttempts },
              date: new Date().toISOString(),
            },
          }),
        });
      }
    } catch (err) {
      console.error("Failed to submit/save summary:", err);
    }
  };

  const resetTest = () => {
    setAttempts([]);
    setCurrentAttempt(1);
    setCurrentRound(1);
    setSummary(null);
    setQuestion(null);
    setElapsedTime(0);
    setIsLoadingResult(false);
    setLoadingStage("");
  };

  // Render views
  if (!introSeen) {
    return (
      <>
        
        <div className="flex justify-center items-center h-screen bg-gray-50">
          <div className="bg-white p-6 rounded-lg shadow-md max-w-lg w-full text-center">
            <h1 className="text-2xl font-semibold text-gray-800 mb-4">Welcome to Arithmetic Test</h1>
            <p className="text-sm text-gray-600 mb-4">
              This test helps screen for potential difficulties in arithmetic processing.
            </p>
            <p className="text-xs text-red-600 italic mb-6">
              Disclaimer: This tool is not diagnostic. It serves as a first-aid or early warning system.
            </p>
            <button
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded"
              onClick={() => setIntroSeen(true)}
            >
              ✅ I Understand, Proceed
            </button>
          </div>
        </div>
      
      </>
    );
  }

  if (!category) {
    return (
      <>
       
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Choose Arithmetic Operation</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
            {[
              { label: "Addition (+)", value: "addition" },
              { label: "Subtraction (−)", value: "subtraction" },
              { label: "Multiplication (×)", value: "multiplication" },
              { label: "Division (÷)", value: "division" },
            ].map((op) => (
              <button
                key={op.value}
                onClick={() => setCategory(op.value)}
                className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-lg font-medium text-gray-700 hover:shadow-md hover:bg-gray-50 transition-all"
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>
      
      </>
    );
  }

  if (isLoadingResult) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-sm font-medium text-gray-600 mb-3 animate-pulse">{loadingStage}</div>
        <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 animate-pulse w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (summary) {
    return (
      <>
      
        <div className="flex justify-center items-center h-screen bg-gray-100">
          <div className="bg-white p-6 rounded-lg shadow-md max-w-md w-full text-center">
            <h2 className="text-xl font-bold mb-4">Test Completed ✅</h2>
            <p className="text-xs text-red-600 italic mb-4">
              This tool analyzes user responses to identify signs of Dyscalculia. It is not a diagnostic tool.
            </p>
            <p className="text-gray-700 text-sm mb-2">Total Correct: {summary.total_correct} / {summary.total_attempts}</p>
            <p className="text-gray-700 text-sm mb-2">Avg. Time: {summary.average_time?.toFixed(2) || "0.00"}s</p>
            <p className="text-gray-700 text-sm mb-2">Speed Category: {summary.speed_category}</p>
            <p className="text-gray-700 text-sm mb-4">Risk Level: {summary.overall_risk}</p>
            <button onClick={resetTest} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">
              🔄 Retake Test
            </button>
          </div>
        </div>
      
      </>
    );
  }

  return (
    <>
   
      <div className="flex flex-col items-center justify-center h-screen bg-white text-center">
        {question && (
          <>
            <h2 className="text-xl font-semibold mb-6 text-gray-700">
              Round {currentRound} - Question {currentAttempt}/{totalAttempts}
            </h2>
            <div className="text-3xl font-bold mb-8">
              {question.op1} {question.operation} {question.op2}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleChoice(question.correctAnswer)}
                className="bg-green-100 p-4 rounded shadow hover:bg-green-200"
              >
                {question.correctAnswer}
              </button>
              <button
                onClick={() => handleChoice(question.incorrectAnswer)}
                className="bg-red-100 p-4 rounded shadow hover:bg-red-200"
              >
                {question.incorrectAnswer}
              </button>
            </div>

            <p className="mt-6 text-sm text-gray-500">Time Elapsed: {elapsedTime.toFixed(1)}s</p>
          </>
        )}
      </div>
    
    </>
  );
};

export default Arithmetic;
