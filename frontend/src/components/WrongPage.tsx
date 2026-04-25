import { useNavigate } from "react-router-dom";

export function WrongPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#171717]">
      <div className="text-center px-6">
        <div className="text-7xl mb-6">🚧</div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">
          Oops! Wrong Page
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-base mb-8 max-w-sm mx-auto">
          This area is for admins only. It looks like you've taken a wrong turn.
          Head back and we'll get you sorted.
        </p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 bg-[#00386B] hover:bg-[#00295A] text-white font-semibold rounded-xl transition-colors shadow-md"
        >
          Take Me Home
        </button>
      </div>
    </div>
  );
}
