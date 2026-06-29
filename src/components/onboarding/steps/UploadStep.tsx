import React, { useState, useRef, useEffect } from "react";
import { useOnboarding } from "../OnboardingProvider";
import { UploadCloud, FileSpreadsheet, AlertCircle, Check, Loader2, RefreshCw, ArrowLeft } from "lucide-react";

interface UploadStepProps {
  currentUser: any;
  onSuccess: (projectId: string) => void;
}

export const UploadStep: React.FC<UploadStepProps> = ({ currentUser, onSuccess }) => {
  const { onboardingData, setWizardStep, resetOnboarding } = useOnboarding();
  
  // File & Upload state
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  // Column Mapping state
  const [detectedCols, setDetectedCols] = useState<any>(null);
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [selectedTextCols, setSelectedTextCols] = useState<string[]>([]);

  // Pipeline execution state
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // 1. Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".csv")) {
        setFile(droppedFile);
      } else {
        alert("Please upload an Excel (.xlsx) or CSV file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // 2. Direct S3 upload & Project creation transaction (Delayed DB Write)
  const handleUploadAndCreateProject = async () => {
    if (!file) return;
    setUploading(true);
    setStatusMessage("Generating Presigned S3 URL...");
    setErrorMessage("");

    try {
      // Step A: Request presigned S3 upload URL
      const urlRes = await fetch("/api/upload/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      if (!urlRes.ok) throw new Error("Failed to get S3 upload signature.");
      const { url, key } = await urlRes.json();

      // Step B: Upload file directly to S3 Bucket
      setStatusMessage("Uploading file directly to AWS S3...");
      const s3Res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });
      if (!s3Res.ok) throw new Error("Failed S3 upload verification.");

      // Step C: Call Projects API POST to create project and parse columns in one transaction
      setStatusMessage("Linking spreadsheet columns...");
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentUser?.email ? { "x-user-email": currentUser.email } : {})
        },
        body: JSON.stringify({
          name: onboardingData.projectName,
          description: onboardingData.projectDesc,
          s3Key: key,
          filename: file.name,
          fileSize: file.size,
          productConfig: {
            productName: onboardingData.productName,
            category: onboardingData.productCategory,
            description: onboardingData.productDescription,
            audience: onboardingData.targetAudience,
            features: onboardingData.keyFeatures,
            competitors: onboardingData.competitors,
            keywords: onboardingData.keywords,
            customInstructions: onboardingData.customInstructions
          }
        })
      });

      const projData = await projRes.json();
      if (!projRes.ok) {
        throw new Error(projData.error || "Failed to create project record.");
      }

      // Populate column mapping preview state
      setCreatedProjectId(projData.projectId);
      setDetectedCols(projData.detectedColumns);
      setAllColumns(projData.allColumns || []);
      setSelectedTextCols(projData.detectedColumns?.textCols || []);
      setStatusMessage("");
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to process survey file.");
    } finally {
      setUploading(false);
    }
  };

  // 3. Trigger analysis and start polling status
  const handleStartAnalysis = async () => {
    if (!createdProjectId) return;
    setAnalysisStarted(true);
    setAnalysisProgress(5);
    setAnalysisStatus("Submitting column overrides...");
    setErrorMessage("");

    try {
      // Save user selected column overrides
      const patchRes = await fetch(`/api/projects/${createdProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textColumns: selectedTextCols })
      });
      if (!patchRes.ok) throw new Error("Failed to configure column mapping.");

      // Trigger background pipeline
      setAnalysisProgress(15);
      setAnalysisStatus("De-duplicating responses...");
      const runRes = await fetch(`/api/projects/${createdProjectId}/analyze`, { method: "POST" });
      if (!runRes.ok) throw new Error("Failed to launch analysis worker.");

      // Start polling DB job status
      startPollingAnalysis(createdProjectId);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "An error occurred starting analysis.");
      setAnalysisStarted(false);
    }
  };

  const startPollingAnalysis = (projectId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const project = data.project;
          const activeJob = project?.analysisJobs?.[0];

          if (activeJob) {
            setAnalysisProgress(activeJob.progress || 10);
            setAnalysisStatus(activeJob.statusDescription || "Processing feedback...");

            if (activeJob.status === "COMPLETED") {
              setAnalysisProgress(100);
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
              
              // Clear LocalStorage draft and success redirect
              resetOnboarding();
              setTimeout(() => onSuccess(projectId), 1500);
            } else if (activeJob.status === "FAILED") {
              setErrorMessage(activeJob.errorMessage || "Feedback processing failed.");
              setAnalysisStarted(false);
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1500);
  };

  const handleForceResetAnalysis = async () => {
    if (!createdProjectId) return;
    setAnalysisStatus("Force resetting previous analysis job...");
    try {
      await fetch(`/api/projects/${createdProjectId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true })
      });
      startPollingAnalysis(createdProjectId);
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Reset failed. Please try again.");
    }
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in font-sans">
      
      {/* Step Heading */}
      <div className="space-y-1">
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Step 3 of 3</span>
        <h2 className="text-xl font-bold text-gray-900 font-sans">
          {detectedCols ? "Configure Column Mapping" : "Upload your survey"}
        </h2>
        <p className="text-xs text-gray-500 font-sans">
          {detectedCols 
            ? "Verify the open-ended text fields before initiating qualitative survey analysis." 
            : "Upload survey spreadsheets in Excel (.xlsx) or CSV format."
          }
        </p>
      </div>

      {/* ERROR MESSAGE PANEL */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-start space-x-3.5 shadow-sm text-xs">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 leading-normal">
            <span className="font-bold uppercase tracking-wider block text-[10px]">Error Processing Request</span>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* PIPELINE IS RUNNING STATE */}
      {analysisStarted ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-5 shadow-sm">
          <div className="flex justify-between items-center text-xs font-bold text-blue-800 uppercase tracking-wider">
            <span className="flex items-center">
              <span className="flex h-2.5 w-2.5 relative mr-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
              {analysisStatus || "Analyzing..."}
            </span>
            <span className="font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">{analysisProgress}%</span>
          </div>

          <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${analysisProgress}%` }}
            ></div>
          </div>
          
          <p className="text-[10px] text-blue-600 leading-normal font-medium">
            Please keep this tab open. The local database pipeline will complete in a few moments.
          </p>

          <button
            onClick={handleForceResetAnalysis}
            className="w-full bg-red-100 hover:bg-red-200 text-red-700 border border-red-200 py-2 rounded text-xs font-semibold transition-all cursor-pointer font-sans"
          >
            Stalled? Force Reset & Rerun
          </button>
        </div>
      ) : (
        <>
          {/* UPLOAD SCREEN: FILE SELECTOR */}
          {!detectedCols ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg flex items-center space-x-2 text-xs font-medium max-w-md mx-auto justify-center">
                <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>✓ Product setup completed. SurveyIQ is ready.</span>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50/50"
                    : "border-gray-300 bg-gray-50 hover:bg-gray-100/75"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx,.csv"
                  className="hidden"
                />
                
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                <p className="text-xs font-bold text-gray-700 mt-4 font-sans">
                  Drag and drop your file here, or <span className="text-blue-600 hover:text-blue-700">browse</span>
                </p>
                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider">Excel (.xlsx) or CSV up to 10MB</p>
                
                {file && (
                  <div className="mt-4 inline-flex items-center bg-blue-50 text-blue-700 border border-blue-150 px-3 py-1.5 rounded-lg text-xs font-semibold">
                    <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                    {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {statusMessage && (
                <div className="text-center text-xs font-semibold text-blue-600 flex items-center justify-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{statusMessage}</span>
                </div>
              )}

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setWizardStep("product")}
                  disabled={uploading}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors flex items-center px-4 py-2 border border-transparent rounded-lg font-sans disabled:opacity-50"
                >
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                  Back
                </button>

                <button
                  onClick={handleUploadAndCreateProject}
                  disabled={!file || uploading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all shadow-sm shadow-blue-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload Survey"
                  )}
                </button>
              </div>
            </div>
          ) : (
            // MAPPING SCREEN: COLUMN SELECTION INLINE PREVIEW
            <div className="space-y-5 animate-fade-in">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-start space-x-3.5 shadow-sm text-xs">
                <Check className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-normal">
                  <span className="font-bold uppercase tracking-wider block text-[10px]">Project Created Successfully</span>
                  <p>Column headers parsed from {file?.name || "sheet"}. Verify open-ended mapping below.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Parsed Headers Count</span>
                  <p className="text-sm font-bold text-gray-800">{allColumns.length} fields</p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-1 col-span-2">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Suggested Text Target</span>
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {detectedCols.textCols?.join(", ") || "None found"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                  Select Open-Ended Feedback Column(s)
                </label>
                <p className="text-xs text-gray-500 leading-normal">
                  Choose which columns contain the comments you want analyzed. You can select multiple.
                </p>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-150 bg-white p-2.5 shadow-inner">
                  {allColumns.map((col) => {
                    const isChecked = selectedTextCols.includes(col);
                    return (
                      <label key={col} className="flex items-center space-x-3 py-2 px-2.5 hover:bg-gray-50 cursor-pointer rounded select-none">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTextCols([...selectedTextCols, col]);
                            } else {
                              setSelectedTextCols(selectedTextCols.filter(c => c !== col));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-gray-300 cursor-pointer"
                        />
                        <span className="text-xs text-gray-700 font-semibold truncate">{col}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    setDetectedCols(null);
                    setFile(null);
                    setCreatedProjectId(null);
                  }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-850 transition-colors flex items-center px-4 py-2 border border-gray-200 rounded-lg bg-white shadow-sm font-sans"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Choose different file
                </button>

                <button
                  onClick={handleStartAnalysis}
                  disabled={selectedTextCols.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-all shadow-sm shadow-emerald-100 flex items-center disabled:opacity-50 disabled:cursor-not-allowed font-sans"
                >
                  Start Analysis
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UploadStep;
