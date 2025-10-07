import { useEffect, useState } from "react";

export const useMinLoading = (isLoading: boolean, minMs = 600) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setShow(true);
      return;
    }
    const t = setTimeout(() => setShow(false), minMs);
    return () => clearTimeout(t);
  }, [isLoading, minMs]);

  return show;
};