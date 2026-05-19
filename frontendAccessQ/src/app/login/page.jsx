"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Login() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include", // Capture HttpOnly cookie
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (data.success) {
                // The backend now sets an HttpOnly cookie securely.
                // We no longer manually sore it in localStorage.
                router.push("/dashboard");
            } else {
                setError(data.message || "Invalid credentials.");
            }
        } catch (err) {
            console.error("Login Error:", err);
            setError("Unable to connect to the server.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex bg-white dark:bg-slate-950 text-slate-900 dark:text-white overflow-hidden relative">
            {/* Left Side - Branding / Logo (Hidden on small screens) */}
            <div className="hidden lg:flex lg:flex-1 relative bg-slate-50 dark:bg-slate-900 items-center justify-center flex-col overflow-hidden">
                {/* Decorative Background Elements */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-300/40 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[60%] rounded-full bg-emerald-300/30 blur-[120px] pointer-events-none" />

                {/* Logo and Tagline */}
                <div className="relative z-10 flex flex-col items-center">
                    <img
                        src="/logo/access_logo.png"
                        alt="QR Access Logo"
                        className="w-64 h-auto drop-shadow-xl mb-8 transform transition-transform hover:scale-105 duration-500"
                    />
                    <h2 className="text-3xl font-semibold bg-gradient-to-r from-blue-700 to-emerald-600 bg-clip-text text-transparent">
                        Welcome Back
                    </h2>
                    <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-md text-center">
                        Access your dashboard to manage your QR codes, events, and agents securely.
                    </p>
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-[600px] xl:w-[700px] flex items-center justify-center p-8 sm:p-12 lg:p-16 relative bg-white dark:bg-slate-950 lg:shadow-[-20px_0_30px_-15px_rgba(0,0,0,0.05)] z-20">
                <div className="w-full max-w-md">
                    {/* Back to home link */}
                    <div className="mb-8">
                        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors group">
                            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            Retour à l'accueil
                        </Link>
                    </div>
                    <div className="mb-10 lg:text-left text-center">
                        <h1 className="text-4xl font-bold tracking-tight mb-3 text-slate-900 dark:text-white">
                            Sign In
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 text-base">
                            Enter your email and password to access your account.
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-center font-medium animate-pulse">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Email Address */}
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block mb-1">
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="lionel@example.com"
                                required
                                className="w-full px-4 py-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none placeholder:text-slate-400 text-sm text-slate-800 dark:text-slate-100"
                            />
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block">
                                    Password
                                </label>
                                <a href="#" className="text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors hover:underline">
                                    Forgot password?
                                </a>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="••••••••"
                                    required
                                    className="w-full px-4 py-3 pr-12 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none placeholder:text-slate-400 text-sm text-slate-800 dark:text-slate-100"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 transition-colors"
                                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full mt-6 py-3.5 px-4 bg-gradient-to-r ${loading ? 'from-slate-400 to-slate-500 cursor-not-allowed' : 'from-blue-600 to-emerald-500 hover:from-blue-700 hover:to-emerald-600 shadow-lg shadow-blue-500/20'} text-white font-medium rounded-lg transition-all active:scale-[0.98]`}
                        >
                            {loading ? "Signing in..." : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Don't have an account yet?{" "}
                        <Link
                            href="/register"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors font-semibold hover:underline"
                        >
                            Create an account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
