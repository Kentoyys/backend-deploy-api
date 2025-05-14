"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";


const DysgraphiaUpload = () => {
  const { data: session } = useSession();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>(""); // For loading stages
  const [resultsReady, setResultsReady] = useState(false);
  const [childId, setChildId] = useState("");
  const [childName, setChildName] = useState("");
  const [childBirthday, setChildBirthday] = useState("");
  const [showDisclaimer, setShowDisclaimer] = useState(false);

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
          setChildId(child._id);
          setChildName(child.name);
          setChildBirthday(new Date(child.birthday).toLocaleDateString());
        }
      }
    };

    fetchChildData();
  }, [session]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files).slice(0, 3);
      setSelectedFiles(filesArray);
      setImagePreviews(filesArray.map((file) => URL.createObjectURL(file)));
    }
  };

 const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  if (selectedFiles.length === 0) {
    alert("Please select at least one handwriting image for analysis.");
    return;
  }

  const formData = new FormData();
  selectedFiles.forEach((file) => formData.append("files", file));

  setLoading(true);
  setLoadingStage("Analyzing images...");
  try {
    const response = await fetch("http://127.0.0.1:8000/handwritten_test/dysgraphia/predict", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setLoadingStage("Getting information...");
      const { Results } = await response.json();
      setPredictions(Results);

      setLoadingStage("Finalizing results...");
      setTimeout(() => {
        setResultsReady(true);
        setShowDisclaimer(true);
        setLoading(false);
      }, 3000); // Simulate finalizing results

      const dysgraphiaScore = Results.reduce(
        (sum: number, result: any) => sum + (result.Confidence || 0),
        0
      );

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
            testName: "Handwriting Test - Dysgraphia",
            result: {
              predictions: Results,
              score: dysgraphiaScore,
            },
            date: new Date().toISOString(),
          },
        }),
      });
    } else {
      setPredictions([{ Prediction: "Error in classification." }]);
      setLoading(false);
    }
  } catch {
    setPredictions([{ Prediction: "Failed to classify images." }]);
    setLoading(false);
  }
};
  const handleDownloadReport = () => {
    const reportContent = `
      Dysgraphia Analysis Report
      ==========================
      Child Name: ${childName}
      Child Birthday: ${childBirthday}
      --------------------------
      ${predictions
        .map(
          (result) =>
            `File: ${result.Filename}\nPrediction: ${result.Prediction}\nConfidence: ${result.Confidence?.toFixed(
              2
            )}\nSeverity: ${result.Severity}\n\n`
        )
        .join("")}
    `;

    const blob = new Blob([reportContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "dysgraphia_report.txt";
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
            .minimalist-table { width: 100%; border-collapse: collapse; }
            .minimalist-table th, .minimalist-table td { border: 1px solid #ddd; padding: 8px; }
            .minimalist-table th { background-color: #f2f2f2; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Dysgraphia Analysis Report</h1>
          <div class="report-section">
            <h2>Child Information</h2>
            <p><strong>Name:</strong> ${childName}</p>
            <p><strong>Birthday:</strong> ${childBirthday}</p>
          </div>
          <div class="report-section">
            <h2>Analysis Results</h2>
            <table class="minimalist-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Prediction</th>
                  <th>Confidence</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                ${predictions
                  .map(
                    (result) => `
                      <tr>
                        <td>${result.Filename}</td>
                        <td>${result.Prediction}</td>
                        <td>${result.Confidence?.toFixed(2)}</td>
                        <td>${result.Severity}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
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
    <div className="min-h-screen flex flex-col bg-gray-50">
      
      <main className="flex-grow flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-md p-6 border">
          <h2 className="text-xl font-semibold text-gray-800 text-center mb-6 pt-14">
            Upload Handwriting Samples
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block w-full">
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 border-2 border-dashed rounded-lg border-gray-300 bg-gray-100 hover:bg-gray-200 cursor-pointer transition">
                <span className="text-sm text-gray-600">Select up to 3 images</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </label>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {imagePreviews.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`Preview ${idx + 1}`}
                    className="w-full h-48 object-contain border rounded-md"
                  />
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition ${
                loading && "opacity-50 cursor-not-allowed"
              }`}
            >
              {loading ? "Analyzing..." : "Analyze Images"}
            </button>
          </form>

          {loading && (
            <div className="mt-6 text-center">
              <p className="text-gray-600 text-sm">{loadingStage}</p>
              <div className="mt-4 animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600"></div>
            </div>
          )}

          {resultsReady && predictions.length > 0 && (
            <section className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Results</h3>
              <div className="space-y-3">
                {predictions.map((result, i) => (
                  <div
                    key={i}
                    className="bg-white border p-4 rounded-md shadow-sm text-sm text-gray-700"
                  >
                    <p><strong>Filename:</strong> {result.Filename}</p>
                    <p><strong>Prediction:</strong> {result.Prediction}</p>
                    <p><strong>Percent:</strong> {(result.Confidence * 100).toFixed(2)}%</p>
                    <p><strong>Indicators:</strong> {result.Severity}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleDownloadReport}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Download Report
                </button>
                <button
                  onClick={handlePrintReport}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Print Report
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      {showDisclaimer && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 px-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full text-center">
            <h3 className="text-lg font-semibold text-gray-800">Important Disclaimer</h3>
            <p className="text-gray-600 text-sm mt-2">
            This tool analyzes user response to indentify potential signs of Dysgraphia It is not a diagnostic tool and should.
              not be used as a substitute for professional evaluation or medical advice
            </p>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              onClick={() => setShowDisclaimer(false)}
            >
              I Understand
            </button>
          </div>
        </div>
      )}

    
    </div>
  );
};

export default DysgraphiaUpload;