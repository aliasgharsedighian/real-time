import { useState, useEffect } from "react";

function useDetectMobile() {
  const [isMobile, setIsMobile] = useState(false);

  function changeHeaderSize() {
    setTimeout(() => {
      if (window.innerWidth <= 768) {
        setIsMobile(true);
        // console.log("mobile", window.innerWidth);
      } else {
        setIsMobile(false);
        // console.log("notMobile", window.innerWidth);
      }
    }, 500);
  }

  useEffect(() => {
    if (window.innerWidth <= 768) {
      setIsMobile(true);
    } else {
      setIsMobile(false);
    }
    window.addEventListener("resize", changeHeaderSize);

    return () => {
      window.removeEventListener("resize", changeHeaderSize);
    };
  }, []);

  useEffect(() => {
    window.addEventListener("resize", changeHeaderSize);
    return () => {
      window.removeEventListener("resize", changeHeaderSize);
    };
  }, [isMobile]);

  return isMobile;
}

export default useDetectMobile;
