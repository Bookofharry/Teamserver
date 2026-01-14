
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OnboardingCarouselProps {
    onComplete: () => void;
}

const slides = [
    {
        title: "Welcome to TeamPad",
        description: "A calm, fast workspace for your team to capture clarity.",
        bg: "from-blue-500/20 via-indigo-500/20 to-purple-500/20",
        icon: "👋",
    },
    {
        title: "Capture Fast, Organize Once",
        description: "Notes, collections, and workspaces designed to keep you in flow.",
        bg: "from-emerald-500/20 via-teal-500/20 to-cyan-500/20",
        icon: "📝",
    },
    {
        title: "Realtime Collaboration",
        description: "Chat, voice notes, and live presence to stay aligned without the noise.",
        bg: "from-orange-500/20 via-amber-500/20 to-yellow-500/20",
        icon: "⚡",
    },
    {
        title: "Team Pulse",
        description: "Set your status emoji and share your vibe instantly.",
        bg: "from-pink-500/20 via-rose-500/20 to-red-500/20",
        icon: "❤️",
    },
];

export function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
    const [index, setIndex] = useState(0);

    const nextSlide = () => {
        if (index < slides.length - 1) {
            setIndex(index + 1);
        } else {
            onComplete();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xl">
            <div className="relative w-full max-w-2xl h-[500px] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.4 }}
                        className={cn(
                            "absolute inset-0 flex flex-col items-center justify-center p-12 text-center bg-gradient-to-br",
                            slides[index].bg
                        )}
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="mb-6 text-6xl"
                        >
                            {slides[index].icon}
                        </motion.div>
                        <motion.h2
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="mb-4 text-4xl font-bold tracking-tight"
                        >
                            {slides[index].title}
                        </motion.h2>
                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="mb-10 text-xl text-muted-foreground max-w-md"
                        >
                            {slides[index].description}
                        </motion.p>

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Button size="lg" onClick={nextSlide} className="rounded-full px-8 text-lg h-12 gap-2 shadow-lg">
                                {index === slides.length - 1 ? (
                                    <>
                                        Get Started <Check className="w-5 h-5" />
                                    </>
                                ) : (
                                    <>
                                        Next <ChevronRight className="w-5 h-5" />
                                    </>
                                )}
                            </Button>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>

                {/* Indicators */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-3">
                    {slides.map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "h-2 rounded-full transition-all duration-300",
                                i === index ? "w-8 bg-primary" : "w-2 bg-primary/20"
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
