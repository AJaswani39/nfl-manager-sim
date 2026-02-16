import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.navigation) {
      this.props.navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.icon}>!</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              The app ran into an unexpected error. Your saved data is safe.
            </Text>

            <ScrollView style={styles.errorBox}>
              <Text style={styles.errorText}>
                {this.state.error?.message || 'Unknown error'}
              </Text>
            </ScrollView>

            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>

            {this.props.navigation && (
              <TouchableOpacity style={styles.homeButton} onPress={this.handleGoHome}>
                <Text style={styles.homeText}>Go to Home Screen</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e74c3c',
    marginBottom: 16,
    width: 72,
    height: 72,
    lineHeight: 72,
    textAlign: 'center',
    borderWidth: 3,
    borderColor: '#e74c3c',
    borderRadius: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  errorBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: '#2a2a3e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 32,
  },
  errorText: {
    fontSize: 12,
    color: '#e74c3c',
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#4a90d9',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 8,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  homeButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4a90d9',
    width: '100%',
    alignItems: 'center',
  },
  homeText: {
    color: '#4a90d9',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ErrorBoundary;
