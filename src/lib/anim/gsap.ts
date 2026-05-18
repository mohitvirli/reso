"use client";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

gsap.defaults({ ease: "power3.out", duration: 0.45 });

export { gsap, useGSAP };
