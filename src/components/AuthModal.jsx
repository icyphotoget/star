import { supabase } from "../lib/supabase";

const AuthModal = ({ onClose }) => {
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin, // nakon logina te vraća na / 
      },
    });

    if (error) {
      console.error("Google login error:", error);
      alert(error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-950 p-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Log in to StarBazaar
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          We use Google to keep your stars connected to your account.
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-100"
        >
          <span>🔐</span>
          <span>Continue with Google</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default AuthModal;
