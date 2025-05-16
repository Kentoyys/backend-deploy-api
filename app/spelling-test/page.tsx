"use client";
import React, { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

type ResultData = {
  user_answer: string;
  correct_word: string;
  is_correct: boolean;
  spelling_incorrect_prob: number;
  spelling_risk: string;
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

useEffect(() => {
  fetch("http://127.0.0.1:8000/spelling_test/get-audio")
    .then(async (res) => {
      const contentType = res.headers.get("Content-Type");
      if (!res.ok || !contentType?.includes("application/json")) {
        const errorText = await res.text();
        throw new Error(`Unexpected response: ${errorText}`);
      }
      return res.json();
    })
    .then((data) => {
      const audioFileName = data.audio_file.replace("audio/correct/", "");
      setAudioUrl(`http://127.0.0.1:8000/${data.audio_file}`);
setAudioFileName(data.audio_file.replace("audio/correct/", ""));
    })
    .catch((err) => {
      console.error(err);
      setError("Failed to load audio. Please try again.");
    });
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
    setResult(data);
    setAttempts((prev) => [...prev, data]);
    setIsLoading(false);

    if (data.is_correct) {
      setSuccessMessage(true);
    }
  } catch (err) {
    console.error(err);
    setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    setIsLoading(false);
  }
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
              <strong>Instructions:</strong> Listen carefully to the audio provided. After listening, type the word exactly as you hear it into the input box. Make sure to double-check your spelling before submitting your answer.
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
              disabled={result?.is_correct} // Disable input if the answer is correct
            />

            <button
              onClick={handleSubmit}
              disabled={!userAnswer.trim() || result?.is_correct} // Disable button if the answer is correct
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

            {successMessage && (
              <div className="mt-4 bg-green-100 text-green-800 text-sm p-4 rounded">
                Your result has been saved to your profile. You can view it{" "}
                <span
                  className="text-blue-600 underline cursor-pointer"
                  onClick={() => router.push("/account/child-account/child-profile")}
                >
                  here
                </span>
                !
              </div>
            )}
          </div>
        </div>
      </main>
  
    </>
  );
};

export default SpellingTask;