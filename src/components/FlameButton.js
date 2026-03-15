import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, ImageBackground, StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Cinzel_700Bold } from '@expo-google-fonts/cinzel';

// Fire gradient keyframes: calm → peak bright → deep orange → (wraps to calm)
const FIRE_FRAMES = [
  ['#FFF8D0', '#FFD84A', '#FF8C00', '#CC3200', '#6B0E00'],
  ['#FFFFFF', '#FFE566', '#FFB300', '#FF4500', '#8B1A00'],
  ['#FFE87A', '#FFA500', '#FF5500', '#BB2000', '#520A00'],
];

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

const BUTTON_WIDTH = 320;
const BUTTON_HEIGHT = 80;

export default function FlameButton({ label = 'BEGIN', onPress }) {
  const [fontsLoaded] = useFonts({ Cinzel_700Bold });

  const flameAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Flame colour cycle through 3 keyframes
  useEffect(() => {
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.timing(flameAnim, { toValue: 1, duration: 900,  useNativeDriver: false }),
        Animated.timing(flameAnim, { toValue: 2, duration: 700,  useNativeDriver: false }),
        Animated.timing(flameAnim, { toValue: 3, duration: 1100, useNativeDriver: false }),
      ])
    );
    cycle.start();
    return () => cycle.stop();
  }, []);


  const handlePressIn  = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  // Build per-stop interpolations (0→1→2→3, frame 3 = frame 0 for seamless loop)
  const frames = [...FIRE_FRAMES, FIRE_FRAMES[0]];
  const stop = (i) => flameAnim.interpolate({ inputRange: [0, 1, 2, 3], outputRange: frames.map((f) => f[i]) });

  if (!fontsLoaded) return null;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <ImageBackground
          source={require('../assets/ui/start_button.png')}
          style={styles.frame}
          resizeMode="stretch"
        >
          {/* Fire gradient clipped to text shape */}
          <MaskedView
            style={styles.maskedContainer}
            maskElement={
              <View style={styles.maskWrapper}>
                <Animated.Text style={styles.maskText}>
                  {label.toUpperCase()}
                </Animated.Text>
              </View>
            }
          >
            <AnimatedLinearGradient
              colors={[stop(0), stop(1), stop(2), stop(3), stop(4)]}
              locations={[0, 0.2, 0.45, 0.72, 1.0]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.gradient}
            />
          </MaskedView>
        </ImageBackground>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  maskedContainer: {
    height: 52,
    width: BUTTON_WIDTH - 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  maskWrapper: {
    flex: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },

  maskText: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 36,
    letterSpacing: 1,
    color: '#000000', // colour irrelevant — mask uses alpha only
    textAlign: 'center',
  },

  gradient: {
    flex: 1,
    width: '100%',
  },
});
