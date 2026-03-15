import { useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';

const FADE_DURATION  = 600; // ms per sentence fade-in
const MS_PER_WORD    = 171; // reading pace: ~351 wpm (normal speed)
const MIN_GAP        = 300; // floor — even a 1-word sentence gets this
const MAX_GAP        = 3500; // ceiling — very long sentences don't wait forever

function readingDelay(sentence, msPerWord) {
  const words = sentence.trim().split(/\s+/).length;
  const minGap = Math.min(MIN_GAP, msPerWord * 2); // scale floor with speed
  return Math.max(minGap, Math.min(MAX_GAP, words * msPerWord));
}

function splitParts(text) {
  if (!text) return [];
  // Split at any natural pause: comma, semicolon, colon, or sentence-end punctuation
  const parts = text.match(/[^,.!?;:]+[,.!?;:]+['")\s]*/g);
  return parts ? parts.map(s => s.trim()).filter(Boolean) : [text];
}

/**
 * Sentence-by-sentence fade-in.
 * Sentences are added to the DOM one at a time (so the parent block grows with them).
 * Each newly-added sentence fades in immediately on reveal.
 *
 * @param {string}  text    Full text to reveal
 * @param {boolean} active  Animates when true; shows full text immediately when false
 * @returns {{ sentences: Array<{text: string, animValue: Animated.Value}>, isDone: boolean }}
 */
export default function useTypewriter(text, active, msPerWord = MS_PER_WORD) {
  const allSentences = text ? splitParts(text) : [];

  // Initialise at correct opacity so a fresh mount with active=false shows text immediately
  const animValues = useRef(allSentences.map(() => new Animated.Value(active ? 0 : 1)));
  const [visibleCount, setVisibleCount] = useState(active ? 0 : allSentences.length);
  const [isDone, setIsDone] = useState(!active);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!active || !text) {
      const sents = splitParts(text || '');
      animValues.current = sents.map(() => new Animated.Value(1));
      setVisibleCount(sents.length);
      setIsDone(true);
      return;
    }

    const sents = splitParts(text);
    animValues.current = sents.map(() => new Animated.Value(0));
    setVisibleCount(0);
    setIsDone(false);

    let idx = 0;
    let cancelled = false;

    function showNext() {
      if (cancelled || idx >= animValues.current.length) {
        if (!cancelled) setIsDone(true);
        return;
      }
      const i = idx;
      idx += 1;
      // Reveal sentence i — this adds it to the DOM and the block grows
      setVisibleCount(i + 1);
      // Immediately start fading it in
      Animated.timing(animValues.current[i], {
        toValue: 1,
        duration: FADE_DURATION,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        timerRef.current = setTimeout(showNext, readingDelay(sents[i], msPerWord));
      });
    }

    timerRef.current = setTimeout(showNext, 80);
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  }, [text, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Only the sentences that have been revealed so far
    sentences: allSentences.slice(0, visibleCount).map((s, i) => ({
      text: s,
      animValue: animValues.current[i],
    })),
    isDone,
  };
}
