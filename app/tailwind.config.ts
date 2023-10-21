import type { Config } from "tailwindcss";
import * as twAnimate from "tailwindcss-animate";
import * as defaultTheme from "tailwindcss/defaultTheme";

export default {
	darkMode: "class",
	content: ["./src/**/*.{ts,tsx}"],
	theme: { extend: { fontFamily: { sans: ["Inter var", ...defaultTheme.fontFamily.sans] } } },
	plugins: [twAnimate],
} satisfies Config;
