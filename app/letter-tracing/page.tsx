"use client";
import React, { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";


export default function LetterTracingTestPage() {
  const { status, data: session } = useSession();
  const router = useRouter();

  const [letter, setLetter] = useState("A");
  const [index, setIndex] = useState(0);
  const letters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", ..."abcdefghijklmnopqrstuvwxyz"];

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [timer, setTimer] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [result, setResult] = useState<{
    label: string;
    confidence: number;
    duration: number;
    accuracy: number;
  } | null>(null);
  const [showNext, setShowNext] = useState(false);
  const [childName, setChildName] = useState("");
  const [childBirthday, setChildBirthday] = useState("");
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchChildData = async () => {
      try {
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
      } catch (error) {
        console.error("Error fetching child data:", error);
      }
    };

    if (session) {
      fetchChildData();
    }
  }, [session]);

 

  useEffect(() => {
    if (index < letters.length) {
      setLetter(letters[index]);
      clearCanvas();
      drawGuide(letters[index]);
      setTimer(0);
      setHasStarted(false);
      setResult(null);
      setShowNext(false);
    }
  }, [index]);

  useEffect(() => {
    if (!hasStarted || isSubmitting) return;
    const iv = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [hasStarted, isSubmitting]);

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  }

  function drawGuide(char: string) {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!ctx || !c) return;
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 6;
    ctx.font = "150px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText(char, c.width / 2, c.height / 2);
  }

  function getCanvasCoordinates(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * c.width) / rect.width,
      y: ((e.clientY - rect.top) * c.height) / rect.height,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasStarted) return;
    const coords = getCanvasCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !coords) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasStarted || e.buttons !== 1) return;
    const coords = getCanvasCoordinates(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !coords) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  async function handleSubmit() {
    if (!canvasRef.current || startTimeRef.current === null) return;

    const duration = (Date.now() - startTimeRef.current) / 1000;
    const drawing = canvasRef.current.toDataURL("image/png");

    try {
      setIsSubmitting(true);
      const res = await fetch("http://127.0.0.1:8000/letter_tracing/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter, drawing, duration, accuracy: 0.85 }),
      });

      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();

      setResult({
        label: json.label,
        confidence: json.confidence,
        duration: json.duration_seconds,
        accuracy: json.accuracy,
      });

      // Save the result to the child's profile
      await fetch("/api/auth/account/save-test-result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentId: (session?.user as any)?.id,
          childName,
          testResult: {
            testName: "Letter Tracing Test - Dysgraphia",
            result: {
              letter,
              label: json.label,
              confidence: json.confidence,
              duration: json.duration_seconds,
              accuracy: json.accuracy,
              predictions: json.predictions || [], // Ensure predictions are saved
            },
            date: new Date().toISOString(),
          },
        }),
      });

      setTimeout(() => {
        setShowNext(true);
      }, 3000);
    } catch (err) {
      console.error(err);
      alert("Submission failed, please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleStart() {
    setHasStarted(true);
    setTimer(0);
    startTimeRef.current = Date.now();
  }

  function handlePrintResult() {
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
          <h1>Letter Tracing Test Results</h1>
          <div class="report-section">
            <h2>Child Information</h2>
            <p><strong>Name:</strong> ${childName}</p>
            <p><strong>Birthday:</strong> ${childBirthday}</p>
          </div>
          <div class="report-section">
            <h2>Test Summary</h2>
            <p><strong>Letter:</strong> ${letter}</p>
            <p><strong>Prediction:</strong> ${result?.label}</p>
            <p><strong>Confidence:</strong> ${(result?.confidence ?? 0 * 100).toFixed(1)}%</p>
            <p><strong>Duration:</strong> ${result?.duration.toFixed(2)} seconds</p>
            <p><strong>Accuracy:</strong> ${((result?.accuracy ?? 0) * 100).toFixed(1)}%</p>
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
  }

  function handleNext() {
    setIndex((prevIndex) => prevIndex + 1);
  }

 
  return (
    <>
     
      <div className="max-w-lg mx-auto p-6 py-24 bg-white shadow-md rounded-lg">
        <h1 className="text-3xl font-bold text-center mb-6 py-14">Letter Tracing Test</h1>

        <div className="bg-blue-100 p-4 rounded mb-6 text-sm text-gray-800">
          <p>
            <strong>Instructions:</strong> Click “Start Test” to begin. Trace the letter as accurately as you can. Use “Reset” if
            needed, then “Submit” when finished.
          </p>
          <p className="mt-2">
            <strong>Note:</strong> This tool analyzes user response to indentify potential signs of Dysgraphia It is not a diagnostic tool and should.
              not be used as a substitute for professional evaluation or medical advice
          </p>
        </div>

        <h2 className="text-xl font-medium text-center mb-4">Trace: {letter}</h2>

        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="border rounded-lg mb-6 w-full"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        />

        <div className="flex justify-center space-x-4 mb-6">
          {!hasStarted ? (
            <button
              onClick={handleStart}
              className="px-6 py-2 bg-green-600 text-white rounded-lg"
            >
              Start Test
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  clearCanvas();
                  drawGuide(letter);
                }}
                className="px-6 py-2 bg-gray-300 rounded-lg"
              >
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg"
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <span className="loader mr-2"></span> Submitting...
                  </span>
                ) : (
                  "Submit"
                )}
              </button>
            </>
          )}
        </div>

        {isSubmitting && (
          <div className="flex justify-center items-center mb-6">
            <div className="loader"></div>
            <p className="ml-2 text-gray-600">Processing your submission...</p>
          </div>
        )}

        {result && (
          <div className="text-center mt-6">
            <p className="font-semibold text-lg">Result</p>
            <p>Time: {result.duration.toFixed(2)}s</p>
            <p>Prediction: {result.label}</p>
            <p>Confidence: {(result.confidence * 100).toFixed(1)}%</p>
            <p>Accuracy: {(result.accuracy * 100).toFixed(1)}%</p>

            <button
              onClick={handlePrintResult}
              className="px-6 py-2 mt-4 bg-gray-500 text-white rounded-lg"
            >
              Print Result
            </button>

            <div className="mt-4">
              <a
                href="/account/child-account/child-profile"
                className="text-blue-600 underline"
              >
                View in Child Profile
              </a>
            </div>
          </div>
        )}

        {showNext && (
          <div className="text-center mt-6">
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg"
            >
              Next
            </button>
          </div>
        )}
      </div>
      
    </>
  );
}