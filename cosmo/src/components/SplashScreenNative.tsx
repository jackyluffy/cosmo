import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedG = Animated.createAnimatedComponent(G);

interface StarProps {
  delay: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  size?: 'small' | 'large';
}

const Star: React.FC<StarProps> = ({ delay, fromX, fromY, toX, toY, size = 'large' }) => {
  const isLarge = size === 'large';

  const translateX = useSharedValue(fromX);
  const translateY = useSharedValue(fromY);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);
  const pulseOpacity = useSharedValue(0.6);
  const pulseScale = useSharedValue(0.95);

  useEffect(() => {
    translateX.value = withTiming(toX, {
      duration: 1500,
      easing: Easing.out(Easing.ease),
    });

    translateY.value = withTiming(toY, {
      duration: 1500,
      easing: Easing.out(Easing.ease),
    });

    opacity.value = withSequence(
      withTiming(0, { duration: delay * 1000 }),
      withTiming(1, { duration: 300 }),
      withTiming(1, { duration: Math.max(0, 1200 - delay * 1000 - 600) }),
      withTiming(0.8, { duration: 300 })
    );

    scale.value = withSequence(
      withTiming(0, { duration: delay * 1000 }),
      withTiming(1.2, { duration: 300 }),
      withTiming(1, { duration: 300 }),
      withTiming(1, { duration: Math.max(0, 1500 - delay * 1000 - 600) })
    );

    if (isLarge) {
      const timer = setTimeout(() => {
        pulseOpacity.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.6, { duration: 750, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        );

        pulseScale.value = withRepeat(
          withSequence(
            withTiming(1.05, { duration: 750, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.95, { duration: 750, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        );
      }, delay * 1000);

      return () => clearTimeout(timer);
    }
  }, [delay, fromX, fromY, toX, toY, isLarge, opacity, pulseOpacity, pulseScale, scale, translateX, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View style={[styles.starContainer, animatedStyle]}>
      {isLarge ? (
        <Svg width={100} height={100} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`starGlow-${delay}`}>
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 1)" />
              <Stop offset="50%" stopColor="rgba(200, 220, 255, 0.8)" />
              <Stop offset="100%" stopColor="rgba(100, 150, 255, 0)" />
            </RadialGradient>
          </Defs>
          <AnimatedG style={pulseStyle}>
            <Circle cx="50" cy="50" r="30" fill={`url(#starGlow-${delay})`} opacity="0.4" />
            <Path
              d="M50 10 L55 45 L90 50 L55 55 L50 90 L45 55 L10 50 L45 45 Z"
              fill="white"
            />
          </AnimatedG>
        </Svg>
      ) : (
        <Animated.View style={[styles.smallStar, pulseStyle]} />
      )}
    </Animated.View>
  );
};

const BackgroundStar: React.FC<{ left: string; top: string; delay: number; duration: number }> = ({
  left,
  top,
  delay,
  duration,
}) => {
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(Math.random() * 0.5 + 0.3, { duration: duration / 2 }),
          withTiming(0, { duration: duration / 2 })
        ),
        -1,
        false
      );
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [delay, duration, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.backgroundStar, animatedStyle, { left, top }]} />;
};

export default function SplashScreenNative() {
  const cOpacity = useSharedValue(0);
  const cScale = useSharedValue(0.5);

  useEffect(() => {
    cOpacity.value = withTiming(1, {
      duration: 1500,
      easing: Easing.out(Easing.ease),
    });

    cScale.value = withTiming(1, {
      duration: 1500,
      easing: Easing.out(Easing.ease),
    });
  }, [cOpacity, cScale]);

  const cAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cOpacity.value,
    transform: [{ scale: cScale.value }],
  }));

  const stars = [
    { fromX: -200, fromY: -150, toX: 70, toY: 90, delay: 0, size: 'large' as const },
    { fromX: 250, fromY: -100, toX: 85, toY: 100, delay: 0.1, size: 'large' as const },
    { fromX: -150, fromY: 200, toX: 60, toY: 110, delay: 0.15, size: 'large' as const },
    { fromX: -300, fromY: -200, toX: 75, toY: 95, delay: 0.2, size: 'small' as const },
    { fromX: 300, fromY: -180, toX: 90, toY: 105, delay: 0.25, size: 'small' as const },
    { fromX: -250, fromY: 100, toX: 65, toY: 85, delay: 0.3, size: 'small' as const },
    { fromX: 280, fromY: 150, toX: 95, toY: 115, delay: 0.35, size: 'small' as const },
    { fromX: -100, fromY: -250, toX: 80, toY: 92, delay: 0.4, size: 'small' as const },
    { fromX: 200, fromY: 220, toX: 70, toY: 108, delay: 0.45, size: 'small' as const },
    { fromX: 350, fromY: 50, toX: 88, toY: 98, delay: 0.5, size: 'small' as const },
  ];

  const backgroundStars = Array.from({ length: 50 }, (_, i) => ({
    key: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    delay: Math.random() * 2,
    duration: 2000 + Math.random() * 2000,
  }));

  return (
    <LinearGradient
      colors={['#0a0e27', '#1a1f45', '#0f1530']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.backgroundStarsContainer}>
        {backgroundStars.map((star) => (
          <BackgroundStar
            key={star.key}
            left={star.left}
            top={star.top}
            delay={star.delay}
            duration={star.duration}
          />
        ))}
      </View>

      <Animated.View style={[styles.cContainer, cAnimatedStyle]}>
        <Text style={styles.cText}>C</Text>
      </Animated.View>

      <View style={styles.starsContainer}>
        {stars.map((star, index) => (
          <Star
            key={index}
            fromX={star.fromX}
            fromY={star.fromY}
            toX={star.toX}
            toY={star.toY}
            delay={star.delay}
            size={star.size}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backgroundStarsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  backgroundStar: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'white',
  },
  cContainer: {
    position: 'relative',
    zIndex: 10,
  },
  cText: {
    fontSize: Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.4,
    color: 'white',
    fontWeight: '400',
  },
  starsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  starContainer: {
    position: 'absolute',
  },
  smallStar: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
  },
});
