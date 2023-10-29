const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import("tailwindcss").Config} */
module.exports = {
	darkMode: "class",
	content: ["./**/*.{ts,tsx,html}"],
	theme: {
		extend: {
			fontFamily: { sans: ["Inter var", ...defaultTheme.fontFamily.sans] },
			colors: { sienna: "#F26E4D" },
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
			transitionProperty: { outline: "outline-color, outline-offset, outline-width" },
		},
	},
	future: { hoverOnlyWhenSupported: true },
	plugins: [require("tailwindcss-animate"), require("tailwind-scrollbar")],
};
