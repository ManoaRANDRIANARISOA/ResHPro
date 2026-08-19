import { useLocation } from "react-router-dom";
import { useEffect } from "react";

interface NotFoundProps {
  title?: string;
  message?: string;
}

const NotFound = ({
  title = "Page introuvable",
  message = "L'adresse demandée ne correspond à aucune page ou établissement valide."
}: NotFoundProps) => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: Tentative d'accès à une route inexistante:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-2xl">
          404
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <p className="text-xs text-gray-400">
          Veuillez vérifier l'URL ou vous rapprocher de votre administrateur.
        </p>
      </div>
    </div>
  );
};

export default NotFound;
