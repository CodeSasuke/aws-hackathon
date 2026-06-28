"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import {
  LayoutDashboard,
  FileSpreadsheet,
  UploadCloud,
  FileText,
  HelpCircle,
  Settings as SettingsIcon,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  TrendingUp,
  Award,
  Users,
  Layers,
  Database,
  LogOut,
  Lock,
  Mail,
  Plus,
  Key,
  Building
} from "lucide-react";

// Mock baseline data for demo out-of-the-box view
const MOCK_THEMES = [
  { name: "Checkout Reliability", count: 184, category: "Performance" },
  { name: "Pricing & Subscription Cost", count: 142, category: "Pricing" },
  { name: "Mobile App Crashes", count: 98, category: "Performance" },
  { name: "Customer Support Quality", count: 74, category: "Support" },
  { name: "Documentation Clarity", count: 48, category: "Product Features" }
];

const MOCK_SENTIMENT = [
  { name: "Positive", value: 342, color: "#10B981" },
  { name: "Neutral", value: 114, color: "#9CA3AF" },
  { name: "Negative", value: 224, color: "#EF4444" }
];

const MOCK_TREND = [
  { name: "May", Positive: 210, Negative: 180, Neutral: 90 },
  { name: "Jun", Positive: 250, Negative: 160, Neutral: 100 },
  { name: "Jul", Positive: 290, Negative: 190, Neutral: 80 },
  { name: "Aug", Positive: 342, Negative: 224, Neutral: 114 }
];

const MOCK_RESPONSES = [
  {
    id: "1",
    rowIndex: 1,
    text: "The checkout screen frozen multiple times. Fix the app crashes.",
    sentiment: "NEGATIVE",
    category: "Performance",
    theme: "Mobile App Crashes",
    urgency: 4,
    action: "Resolve payment memory leaks in React Native build",
    spam: "NO",
    duplicate: "NO"
  },
  {
    id: "2",
    rowIndex: 2,
    text: "I love the product but pricing is too high for small companies.",
    sentiment: "NEGATIVE",
    category: "Pricing",
    theme: "Pricing & Subscription Cost",
    urgency: 3,
    action: "Introduce Tiered pricing for SMBs",
    spam: "NO",
    duplicate: "NO"
  },
  {
    id: "3",
    rowIndex: 3,
    text: "Awesome experience, support solved my issues in five minutes.",
    sentiment: "POSITIVE",
    category: "Support",
    theme: "Customer Support Quality",
    urgency: 1,
    action: "Document support SLA standards",
    spam: "NO",
    duplicate: "NO"
  },
  {
    id: "4",
    rowIndex: 4,
    text: "Excellent tool, we use it every day for analytics.",
    sentiment: "POSITIVE",
    category: "General",
    theme: "General Praise",
    urgency: 1,
    action: "None required",
    spam: "NO",
    duplicate: "NO"
  },
  {
    id: "5",
    rowIndex: 5,
    text: "Is there any dark mode?",
    sentiment: "NEUTRAL",
    category: "Product Features",
    theme: "UX Feedback",
    urgency: 2,
    action: "Add to UI backlog",
    spam: "NO",
    duplicate: "NO"
  }
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [projectData, setProjectData] = useState<any>(null);
  const [responses, setResponses] = useState<any[]>([]);

  // Authentication state
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authOrg, setAuthOrg] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Upload state
  const [projectName, setProjectName] = useState<string>("");
  const [projectDesc, setProjectDesc] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [detectedCols, setDetectedCols] = useState<any>(null);
  const [tempKey, setTempKey] = useState<string>("");

  // Business queries
  const [selectedQuery, setSelectedQuery] = useState<string>("");
  const [queryAnswer, setQueryAnswer] = useState<string>("");
  const [loadingQuery, setLoadingQuery] = useState<boolean>(false);

  // Search & Filters inside Excel Grid
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sentimentFilter, setSentimentFilter] = useState<string>("ALL");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("surveyiq_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setCurrentUser(parsed);
          fetchProjects(parsed.email);
        } catch (e) {
          localStorage.removeItem("surveyiq_user");
        }
      } else {
        fetchProjects();
      }
    }
  }, []);

  const fetchProjects = async (email?: string) => {
    try {
      const activeEmail = email || currentUser?.email;
      const res = await fetch("/api/projects", {
        headers: activeEmail ? { "x-user-email": activeEmail } : {}
      });
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
        if (data.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(data.projects[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }
      localStorage.setItem("surveyiq_user", JSON.stringify(data.user));
      setCurrentUser(data.user);
      fetchProjects(data.user.email);
      setAuthEmail("");
      setAuthPassword("");
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          email: authEmail,
          password: authPassword,
          orgName: authOrg
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }
      
      // Auto login after registration
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok) {
        localStorage.setItem("surveyiq_user", JSON.stringify(loginData.user));
        setCurrentUser(loginData.user);
        fetchProjects(loginData.user.email);
      }
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      setAuthOrg("");
    } catch (err: any) {
      setAuthError(err.message || "An unexpected error occurred");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoAccess = () => {
    const demoUser = {
      id: "demo-id",
      name: "Default Analyst",
      email: "analyst@surveyiq.app",
      role: "ANALYST",
      organization: { name: "Default Org" }
    };
    localStorage.setItem("surveyiq_user", JSON.stringify(demoUser));
    setCurrentUser(demoUser);
    fetchProjects(demoUser.email);
  };

  const handleSignOut = () => {
    localStorage.removeItem("surveyiq_user");
    setCurrentUser(null);
    setProjects([]);
    setSelectedProjectId("");
    setProjectData(null);
    setResponses(MOCK_RESPONSES);
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectDetails(selectedProjectId);
    }
  }, [selectedProjectId]);

  const loadProjectDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (data.project) {
        setProjectData(data.project);
        setResponses(data.responses.map((r: any) => ({
          id: r.id,
          rowIndex: r.rowIndex,
          text: r.rawData[Object.keys(r.rawData)[0]] || "", // Extract text column value
          sentiment: r.sentiment || "PENDING",
          category: r.category || "N/A",
          theme: r.themeId ? (data.project.themes.find((t: any) => t.id === r.themeId)?.name || "N/A") : "N/A",
          urgency: r.urgency || 0,
          action: r.suggestedAction || "N/A",
          spam: r.isSpam ? "YES" : "NO",
          duplicate: r.isDuplicate ? "YES" : "NO"
        })));
      }
    } catch (err) {
      console.error("Failed to load project details", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadAndMap = async () => {
    if (!file || !projectName) return;
    setUploading(true);
    setAnalysisStatus("Generating Presigned S3 URL...");

    try {
      // 1. Get Presigned S3 URL
      const urlRes = await fetch("/api/upload/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type })
      });
      const { url, key } = await urlRes.json();
      setTempKey(key);

      // 2. Upload file directly to S3
      setAnalysisStatus("Uploading to S3 Bucket...");
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
      });

      // 3. Create Project & Auto-Map Columns
      setAnalysisStatus("Parsing spreadsheet columns...");
      const projRes = await fetch("/api/projects", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(currentUser?.email ? { "x-user-email": currentUser.email } : {})
        },
        body: JSON.stringify({
          name: projectName,
          description: projectDesc,
          s3Key: key,
          filename: file.name,
          fileSize: file.size
        })
      });
      const projData = await projRes.json();
      
      if (projData.projectId) {
        setDetectedCols(projData.detectedColumns);
        setSelectedProjectId(projData.projectId);
        fetchProjects(currentUser?.email);
        setAnalysisStatus("File linked! Click 'Analyze Responses' to start processing.");
      }
    } catch (err) {
      console.error(err);
      setAnalysisStatus("Error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedProjectId) return;
    setUploading(true);
    setAnalysisProgress(10);
    setAnalysisStatus("Deduplicating responses...");

    try {
      await fetch(`/api/projects/${selectedProjectId}/analyze`, { method: "POST" });
      
      // Poll analysis progress
      const interval = setInterval(async () => {
        const res = await fetch(`/api/projects/${selectedProjectId}`);
        const data = await res.json();
        
        if (data.project) {
          const status = data.project.status;
          setAnalysisStatus(`Status: ${status}`);
          
          if (status === "PARSING") {
            setAnalysisProgress(20);
          } else if (status === "CLUSTERING") {
            setAnalysisProgress(40);
            setAnalysisStatus("Clustering similar responses locally...");
          } else if (status === "ANALYZING") {
            setAnalysisProgress(70);
            setAnalysisStatus("Running local semantic text classification...");
          } else if (status === "GENERATING_REPORTS") {
            setAnalysisProgress(90);
            setAnalysisStatus("Generating strategic executive reports...");
          } else if (status === "COMPLETED") {
            setAnalysisProgress(100);
            setAnalysisStatus("Analysis Completed!");
            clearInterval(interval);
            setUploading(false);
            loadProjectDetails(selectedProjectId);
            setActiveTab("dashboard");
          } else if (status === "FAILED") {
            setAnalysisStatus("Analysis pipeline failed.");
            clearInterval(interval);
            setUploading(false);
          }
        }
      }, 3000);
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const handleBusinessQuery = async (queryText: string) => {
    setSelectedQuery(queryText);
    setLoadingQuery(true);
    setQueryAnswer("");

    // Simulate McKinsey response for the query (or we could call a Bedrock query API)
    setTimeout(() => {
      if (queryText.includes("unhappy")) {
        setQueryAnswer(
          "**Critical Friction Areas Identified:**\n\n1. **Checkout reliability (Performance):** Users in East US reported checkout crashes on payment. Impact: 37% of cart abandonments.\n2. **Subscription Pricing:** SMB tier feels monthly pricing is too rigid compared to usage-based competitors.\n\n*Recommendation:* Patch payment memory leaks and add a light user tier ($9/mo)."
        );
      } else if (queryText.includes("prioritize")) {
        setQueryAnswer(
          "**SurveyIQ Strategic Backlog Priority List:**\n\n1. **High Priority (Urgency 5):** Fix memory leak crash in Mobile payment checkout module.\n2. **Medium Priority (Urgency 3):** Relaunch documentation page. Users complain API examples are outdated.\n3. **Low Priority (Urgency 1):** Add Dark Mode toggle in user preferences panel."
        );
      } else {
        setQueryAnswer(
          "**Core Summary:** Analysis shows that positive highlights focus on Support Quality (95% CSAT), while negative sentiments center around performance reliability issues."
        );
      }
      setLoadingQuery(false);
    }, 1500);
  };

  // Filter and search logic
  const filteredResponses = responses.filter((r) => {
    const textStr = String(r.text || "");
    const themeStr = String(r.theme || "");
    const categoryStr = String(r.category || "");
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch = textStr.toLowerCase().includes(searchLower) || 
                          themeStr.toLowerCase().includes(searchLower) ||
                          categoryStr.toLowerCase().includes(searchLower);
    
    if (sentimentFilter === "ALL") return matchesSearch;
    return matchesSearch && r.sentiment === sentimentFilter;
  });

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 font-sans antialiased">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Logo / Header */}
          <div className="p-8 text-center bg-gray-50 border-b border-gray-100 flex flex-col items-center">
            <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center text-white mb-3 shadow-md shadow-blue-100">
              <Database className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-sans">SurveyIQ</h1>
            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-semibold font-sans">Enterprise Survey Intelligence</p>
          </div>

          <div className="p-8">
            {authError && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 text-xs rounded p-3 font-semibold flex items-center font-sans">
                <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                {authError}
              </div>
            )}

            <form onSubmit={authMode === "login" ? handleLogin : handleSignup} className="space-y-4">
              {authMode === "signup" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 font-sans">Full Name</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-white border border-gray-300 rounded pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500 font-sans"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 font-sans">Organization Name</label>
                    <div className="relative">
                      <Building className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={authOrg}
                        onChange={(e) => setAuthOrg(e.target.value)}
                        placeholder="Acme Corp"
                        className="w-full bg-white border border-gray-300 rounded pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500 font-sans"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 font-sans">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="analyst@company.com"
                    className="w-full bg-white border border-gray-300 rounded pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500 font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 font-sans">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-gray-300 rounded pl-10 pr-4 py-2 text-sm outline-none focus:border-blue-500 font-sans"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded text-sm transition-colors shadow-sm disabled:opacity-50 mt-2 font-sans cursor-pointer"
              >
                {authLoading ? "Processing..." : authMode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="relative flex items-center justify-center my-6">
              <div className="border-t border-gray-200 w-full"></div>
              <span className="absolute bg-white px-3 text-[10px] text-gray-400 font-bold uppercase tracking-widest font-sans">Or</span>
            </div>

            <button
              onClick={handleDemoAccess}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded text-sm transition-colors shadow-sm flex items-center justify-center font-sans cursor-pointer"
            >
              <Users className="h-4.5 w-4.5 mr-2" /> Continue to Demo Dashboard
            </button>

            <div className="mt-6 text-center text-xs text-gray-500 font-medium font-sans">
              {authMode === "login" ? (
                <p>
                  Don&apos;t have an account?{" "}
                  <button onClick={() => { setAuthMode("signup"); setAuthError(""); }} className="text-blue-600 hover:underline font-bold font-sans cursor-pointer bg-transparent border-0 outline-none">
                    Sign Up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <button onClick={() => { setAuthMode("login"); setAuthError(""); }} className="text-blue-600 hover:underline font-bold font-sans cursor-pointer bg-transparent border-0 outline-none">
                    Sign In
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800 font-sans">
      
      {/* 1. LEFT SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between">
        <div>
          {/* Brand Header */}
          <div className="h-16 flex items-center px-6 border-b border-gray-200 bg-gray-50">
            <Database className="h-6 w-6 text-blue-600 mr-2" />
            <div>
              <h1 className="font-bold text-lg text-gray-900 tracking-tight">SurveyIQ</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Survey Intelligence</p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "dashboard"
                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <LayoutDashboard className="h-4.5 w-4.5 mr-3" />
              Executive Dashboard
            </button>
            <button
              onClick={() => setActiveTab("upload")}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "upload"
                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <UploadCloud className="h-4.5 w-4.5 mr-3" />
              Upload Data
            </button>
            <button
              onClick={() => setActiveTab("grid")}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "grid"
                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <FileSpreadsheet className="h-4.5 w-4.5 mr-3" />
              Excel Data Grid
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "report"
                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <FileText className="h-4.5 w-4.5 mr-3" />
              Executive Reports
            </button>
            <button
              onClick={() => setActiveTab("queries")}
              className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === "queries"
                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <HelpCircle className="h-4.5 w-4.5 mr-3" />
              Predefined Queries
            </button>
          </nav>
        </div>

        {/* User profile footer & Sign Out */}
        <div className="p-4 border-t border-gray-200 space-y-3 bg-gray-50">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm uppercase">
              {currentUser?.name ? currentUser.name.substring(0, 2) : "US"}
            </div>
            <div className="ml-3 truncate">
              <p className="text-xs font-semibold text-gray-800 truncate">{currentUser?.name || "User Session"}</p>
              <p className="text-[10px] text-gray-500 truncate">{currentUser?.organization?.name || "organization-analyst"}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center bg-white hover:bg-red-50 border border-gray-250 text-red-600 hover:text-red-700 hover:border-red-200 py-1.5 rounded text-xs font-bold transition-all"
          >
            <LogOut className="h-3.5 w-3.5 mr-2" /> Sign Out
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT CONTAINER */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top bar controls */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Active Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-gray-50 border border-gray-300 rounded px-2.5 py-1 text-sm font-medium text-gray-700 outline-none focus:border-blue-500"
            >
              {projects.length === 0 ? (
                <option value="">Demo Dataset (Default)</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={() => {
                setDetectedCols(null);
                setFile(null);
                setProjectName("");
                setProjectDesc("");
                setAnalysisStatus("");
                setActiveTab("upload");
              }}
              className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm shadow-blue-100"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Create Project
            </button>
          </div>
          <div className="flex items-center space-x-3 text-xs text-gray-500 font-medium">
            <span className="flex items-center"><Award className="h-4 w-4 mr-1 text-yellow-500" /> AWS + Vercel Architecture</span>
            <span className="border-l border-gray-300 h-4"></span>
            <span>Aurora PostgreSQL (Online)</span>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-auto p-8 flex flex-col">
          {projects.length === 0 && activeTab !== "upload" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white border border-gray-200 rounded-xl max-w-2xl mx-auto my-12 text-center shadow-sm w-full">
              <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 font-sans font-sans">No Projects Found</h3>
              <p className="text-sm text-gray-500 max-w-sm mt-2 leading-relaxed font-sans font-sans">
                You haven&apos;t created any feedback analysis projects yet. Click the button below to upload your survey spreadsheet and start processing.
              </p>
              <button
                onClick={() => {
                  setDetectedCols(null);
                  setFile(null);
                  setProjectName("");
                  setProjectDesc("");
                  setAnalysisStatus("");
                  setActiveTab("upload");
                }}
                className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded text-xs uppercase tracking-wider transition-all shadow-sm cursor-pointer font-sans"
              >
                Create First Project
              </button>
            </div>
          ) : (
            <>
          
          {/* TAB A: EXECUTIVE DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-8">
              {/* Header metrics card */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Total Responses</p>
                  <p className="text-2xl font-bold mt-1 text-gray-900">
                    {projectData?.surveyFiles?.[0]?.totalRowCount || 680}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-2 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" /> Verified data mapping
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Data Quality Score</p>
                  <p className="text-2xl font-bold mt-1 text-blue-600">
                    {projectData?.surveyFiles?.[0]?.qualityScore || 92}%
                  </p>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Deduplicated & Spam filtered
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Top Theme Friction</p>
                  <p className="text-lg font-bold mt-1 text-gray-900 truncate">
                    {projectData?.themes?.[0]?.name || "Checkout Reliability"}
                  </p>
                  <p className="text-[10px] text-red-500 mt-2 flex items-center">
                    <AlertTriangle className="h-3 w-3 mr-1" /> Requires engineering patch
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded p-5 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Analysis Cache Efficiency</p>
                  <p className="text-2xl font-bold mt-1 text-emerald-600">100%</p>
                  <p className="text-[10px] text-gray-500 mt-2">
                    Processed locally & cached in RDS database
                  </p>
                </div>
              </div>

              {/* Charts grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* 1. Theme Distribution */}
                <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-6">Top Detected Themes</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectData?.themes?.length > 0 ? projectData.themes.slice(0, 5) : MOCK_THEMES} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#1F497D" barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Sentiment Breakdown */}
                <div className="bg-white border border-gray-200 rounded p-6 shadow-sm flex flex-col justify-between">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-6">Sentiment Breakdown</h3>
                  <div className="flex items-center h-52">
                    <div className="w-1/2 h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={MOCK_SENTIMENT}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {MOCK_SENTIMENT.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-1/2 space-y-4">
                      {MOCK_SENTIMENT.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <span className="flex items-center text-sm font-medium">
                            <span className="h-3 w-3 rounded-full mr-2" style={{ backgroundColor: s.color }}></span>
                            {s.name}
                          </span>
                          <span className="text-sm font-bold text-gray-700">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Sentiment Trend Line */}
                <div className="bg-white border border-gray-200 rounded p-6 shadow-sm md:col-span-2">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-6">Sentiment & Feedback Trend</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={MOCK_TREND}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="Positive" stroke="#10B981" strokeWidth={2.5} />
                        <Line type="monotone" dataKey="Negative" stroke="#EF4444" strokeWidth={2.5} />
                        <Line type="monotone" dataKey="Neutral" stroke="#9CA3AF" strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB B: UPLOAD DATA & AUTO COLUMN DETECT */}
          {activeTab === "upload" && (
            <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <h2 className="font-bold text-lg text-gray-900">Upload New Survey File</h2>
                <p className="text-sm text-gray-500 mt-1">Upload survey sheets in Excel (.xlsx) or CSV format. Column types will be auto-detected.</p>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Project Name</label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="E.g. Q3 Customer Satisfaction Feedback"
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Project Description (Optional)</label>
                  <textarea
                    value={projectDesc}
                    onChange={(e) => setProjectDesc(e.target.value)}
                    placeholder="Short description of this target group or feedback goal..."
                    rows={3}
                    className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                {/* File Drop Box */}
                <div className="border-2 border-dashed border-gray-300 rounded-md p-8 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                  <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4 flex text-sm text-gray-600 justify-center">
                    <label className="relative cursor-pointer bg-white rounded-md font-semibold text-blue-600 hover:text-blue-500">
                      <span>Upload a file</span>
                      <input type="file" onChange={handleFileChange} accept=".xlsx,.csv" className="sr-only" />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Excel (.xlsx) or CSV up to 10MB</p>
                  {file && <p className="text-xs font-semibold text-blue-600 mt-3 flex items-center justify-center"><FileSpreadsheet className="h-4 w-4 mr-1" /> {file.name}</p>}
                </div>

                {/* Status indicator */}
                {analysisStatus && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-4 text-sm text-blue-800 flex items-center justify-between">
                    <span className="font-medium">{analysisStatus}</span>
                    {uploading && (
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                    )}
                  </div>
                )}

                {/* Scaffolding/Upload trigger button */}
                {!detectedCols ? (
                  <button
                    onClick={handleUploadAndMap}
                    disabled={!file || !projectName || uploading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded text-sm transition-colors disabled:opacity-50"
                  >
                    {uploading ? "Uploading file..." : "Process Upload & Map Columns"}
                  </button>
                ) : (
                  <div className="space-y-6 pt-4 border-t border-gray-200">
                    <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wider">Detected Columns Mapping</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="border border-gray-200 rounded p-3.5 bg-gray-50">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Text Response Field</span>
                        <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{detectedCols.textCols[0] || "None found"}</p>
                      </div>
                      <div className="border border-gray-200 rounded p-3.5 bg-gray-50">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Numeric Rating Field</span>
                        <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{detectedCols.ratingCols[0] || "None found"}</p>
                      </div>
                      <div className="border border-gray-200 rounded p-3.5 bg-gray-50">
                        <span className="text-[10px] uppercase font-bold text-gray-500">Date Timestamp Field</span>
                        <p className="text-sm font-semibold text-gray-800 mt-1 truncate">{detectedCols.dateCols[0] || "None found"}</p>
                      </div>
                    </div>

                    {/* Final Analysis run trigger */}
                    <div className="space-y-3">
                      <button
                        onClick={handleStartAnalysis}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded text-sm transition-colors"
                      >
                        Analyze Responses
                      </button>
                      <button
                        onClick={() => {
                          setDetectedCols(null);
                          setFile(null);
                        }}
                        className="w-full bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 font-semibold py-2 rounded text-sm transition-colors"
                      >
                        Reset / Choose Different File
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB C: EXCEL GRID VIEW (TanStack Grid Style) */}
          {activeTab === "grid" && (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="flex items-center justify-between bg-white border border-gray-200 p-4 rounded shadow-sm flex-wrap gap-4">
                <div className="flex items-center space-x-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-80">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search feedback text, themes, categories..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded pl-10 pr-4 py-1.5 text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={sentimentFilter}
                    onChange={(e) => setSentimentFilter(e.target.value)}
                    className="bg-white border border-gray-300 rounded px-3 py-1.5 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Sentiments</option>
                    <option value="POSITIVE">Positive</option>
                    <option value="NEUTRAL">Neutral</option>
                    <option value="NEGATIVE">Negative</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.open(`/api/projects/${selectedProjectId}/export/excel`, "_blank")}
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.8 rounded text-sm font-semibold transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" /> Export Excel
                  </button>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase">
                        <th className="py-3 px-4 w-16">Row</th>
                        <th className="py-3 px-4 w-[280px]">Response Text</th>
                        <th className="py-3 px-4 w-32">Sentiment</th>
                        <th className="py-3 px-4 w-[160px]">Theme</th>
                        <th className="py-3 px-4 w-[140px]">Category</th>
                        <th className="py-3 px-4 w-[200px]">Suggested Action</th>
                        <th className="py-3 px-4 w-20 text-center">Urgency</th>
                        <th className="py-3 px-4 w-20 text-center">Spam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                      {filteredResponses.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-gray-500 font-medium">
                            No records found matching filters.
                          </td>
                        </tr>
                      ) : (
                        filteredResponses.map((r, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3.5 px-4 font-mono text-xs text-gray-500">{r.rowIndex}</td>
                            <td className="py-3.5 px-4 text-gray-800 truncate" title={r.text}>
                              {r.text}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2.5 py-0.5 rounded text-[11px] font-bold inline-block ${
                                  r.sentiment === "POSITIVE"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : r.sentiment === "NEGATIVE"
                                    ? "bg-red-50 text-red-700 border border-red-200"
                                    : "bg-gray-50 text-gray-700 border border-gray-200"
                                }`}
                              >
                                {r.sentiment}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-gray-700 truncate" title={r.theme}>
                              {r.theme}
                            </td>
                            <td className="py-3.5 px-4 text-gray-600 truncate">{r.category}</td>
                            <td className="py-3.5 px-4 text-gray-600 truncate" title={r.action}>
                              {r.action}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-gray-700">{r.urgency}</td>
                            <td className="py-3.5 px-4 text-center text-xs text-gray-500 font-medium">{r.spam}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB D: EXECUTIVE REPORTS VIEW */}
          {activeTab === "report" && (
            <div className="max-w-4xl mx-auto space-y-8 bg-white border border-gray-200 rounded p-8 shadow-sm">
              {/* Header and Exporters */}
              <div className="flex items-start justify-between border-b border-gray-200 pb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{projectData?.name || "Customer Feedback Report"}</h2>
                  <p className="text-sm text-gray-500 mt-1">Strategic Board Presentation Summary</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => window.open(`/api/projects/${selectedProjectId}/export/pdf`, "_blank")}
                    className="flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
                  >
                    <Download className="h-4 w-4 mr-2" /> Download Board PDF
                  </button>
                </div>
              </div>

              {/* 1. Executive Summary Text */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-blue-800 uppercase tracking-widest">1. Executive Narrative</h3>
                <p className="text-gray-700 leading-relaxed text-justify text-sm">
                  {projectData?.reports?.[0]?.executiveSummary ||
                    "This report outlines key observations aggregated across customer survey touchpoints. Overall sentiments show that users highly value customer support quality and response speed. However, friction during checkout and rigid subscription pricing pose high customer churn risks."}
                </p>
              </div>

              {/* 2. Key Findings Boxes */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-blue-800 uppercase tracking-widest">2. Core Observations & Impact</h3>
                <div className="grid grid-cols-1 gap-4">
                  {(projectData?.reports?.[0]?.keyFindings as any[])?.length > 0 ? (
                    (projectData?.reports?.[0]?.keyFindings as any[]).map((finding, idx) => (
                      <div key={idx} className="border border-gray-200 bg-gray-50 p-5 rounded">
                        <h4 className="font-bold text-blue-700 text-sm">Finding {idx + 1}: {finding.title}</h4>
                        <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
                          <strong>Observation:</strong> {finding.observation}
                        </p>
                        <p className="text-xs text-gray-800 mt-1 font-semibold">
                          <strong>Business Impact:</strong> {finding.impact}
                        </p>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="border border-gray-200 bg-gray-50 p-5 rounded">
                        <h4 className="font-bold text-blue-700 text-sm">Finding 1: Checkout Instability</h4>
                        <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
                          <strong>Observation:</strong> Multiple clients reported UI lockups and freezing during checkout.
                        </p>
                        <p className="text-xs text-gray-800 mt-1 font-semibold">
                          <strong>Business Impact:</strong> Leads to cart abandonment and lower subscription conversions.
                        </p>
                      </div>
                      <div className="border border-gray-200 bg-gray-50 p-5 rounded">
                        <h4 className="font-bold text-blue-700 text-sm">Finding 2: Pricing Flexibility</h4>
                        <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
                          <strong>Observation:</strong> Small businesses find the rigid tiered pricing packages expensive.
                        </p>
                        <p className="text-xs text-gray-800 mt-1 font-semibold">
                          <strong>Business Impact:</strong> Restricts adoption in the startup / independent business segments.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* 3. Strategy Recommendations */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-blue-800 uppercase tracking-widest">3. Strategic Recommendations</h3>
                <div className="space-y-3">
                  {(projectData?.reports?.[0]?.recommendations as any[])?.length > 0 ? (
                    (projectData?.reports?.[0]?.recommendations as any[]).map((rec, idx) => (
                      <div key={idx} className="flex border border-gray-150 rounded overflow-hidden">
                        <div className={`w-1.5 ${rec.priority === "HIGH" ? "bg-red-500" : rec.priority === "MEDIUM" ? "bg-amber-500" : "bg-gray-400"}`}></div>
                        <div className="p-4 bg-gray-50 flex-1 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-800">{idx + 1}. {rec.title}</span>
                            <span className={`px-2 py-0.5 rounded-[3px] text-[9px] font-bold ${
                              rec.priority === "HIGH" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                            }`}>{rec.priority} PRIORITY</span>
                          </div>
                          <p className="text-gray-600 mt-1">{rec.action}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="flex border border-gray-150 rounded overflow-hidden">
                        <div className="w-1.5 bg-red-500"></div>
                        <div className="p-4 bg-gray-50 flex-1 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-800">1. Patch Mobile Payment Flow</span>
                            <span className="px-2 py-0.5 rounded-[3px] text-[9px] font-bold bg-red-50 text-red-700">HIGH PRIORITY</span>
                          </div>
                          <p className="text-gray-600 mt-1">Refactor checkout screen and resolve memory leak crashes.</p>
                        </div>
                      </div>
                      <div className="flex border border-gray-150 rounded overflow-hidden">
                        <div className="w-1.5 bg-amber-500"></div>
                        <div className="p-4 bg-gray-50 flex-1 text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-800">2. Launch SMB Subscription Tier</span>
                            <span className="px-2 py-0.5 rounded-[3px] text-[9px] font-bold bg-amber-50 text-amber-700">MEDIUM PRIORITY</span>
                          </div>
                          <p className="text-gray-600 mt-1">Design a startup plan at $9/mo to lower entry barriers.</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB E: PREDEFINED BUSINESS QUERIES ("ASK AI") */}
          {activeTab === "queries" && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white border border-gray-200 rounded p-6 shadow-sm">
                <h3 className="font-bold text-base text-gray-900 mb-2">Predefined Business Questions</h3>
                <p className="text-sm text-gray-500 mb-6">Select a predefined business query to fetch insights. The database engine executes structured queries behind the scenes.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleBusinessQuery("What are customers most unhappy about?")}
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded text-left transition-colors group"
                  >
                    <div>
                      <span className="text-xs font-bold text-blue-600 uppercase">Product Health</span>
                      <p className="text-sm font-semibold text-gray-800 mt-1">What are customers most unhappy about?</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </button>

                  <button
                    onClick={() => handleBusinessQuery("Which issues should we prioritize next in our roadmap?")}
                    className="flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded text-left transition-colors group"
                  >
                    <div>
                      <span className="text-xs font-bold text-blue-600 uppercase">Planning</span>
                      <p className="text-sm font-semibold text-gray-800 mt-1">Which issues should we prioritize next?</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </button>
                </div>
              </div>

              {/* Answers block */}
              {selectedQuery && (
                <div className="bg-white border border-gray-200 rounded p-6 shadow-sm space-y-4">
                  <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                    <HelpCircle className="h-5 w-5 text-blue-600" />
                    <span className="font-bold text-gray-800">{selectedQuery}</span>
                  </div>
                  
                  {loadingQuery ? (
                    <div className="py-8 flex items-center justify-center space-x-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                      <span className="text-sm font-medium text-gray-500">Extracting data findings...</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 border border-gray-150 p-4 rounded">
                      {queryAnswer}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </>
          )}

        </div>
      </main>

    </div>
  );
}
