import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import "./index.css";
import { Presets, ResponsivenessProvider } from "react-responsiveness";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ResponsivenessProvider breakpoints={Presets.Tailwind_CSS}>
			<App />
		</ResponsivenessProvider>
	</React.StrictMode>,
);
