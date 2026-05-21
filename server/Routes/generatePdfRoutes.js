import pdfRoute from "./pdfRoutes.js";

// Preserve the legacy `/api/generate-pdf` mount by reusing the maintained PDF router.
export default pdfRoute;
