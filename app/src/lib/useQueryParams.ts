import { useEffect, useState } from "react";

export const useQueryParams = () => {
	const [queryParams, setQueryParams] = useState(() => {
		return new URLSearchParams(window.location.search);
	});

	useEffect(() => {
		const handlePopState = () => {
			setQueryParams(new URLSearchParams(window.location.search));
		};

		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, []);

	const setUrlQueryParam = (key: string, value: string) => {
		const newParams = new URLSearchParams(queryParams);
		newParams.set(key, value);

		window.history.pushState(null, "", `?${newParams.toString()}`);
		setQueryParams(newParams);
	};

	return [queryParams, setUrlQueryParam] as const;
};
