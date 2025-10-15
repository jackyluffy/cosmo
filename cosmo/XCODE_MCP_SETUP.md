# Xcode MCP Server Integration

## Overview
The Xcode MCP (Model Context Protocol) server provides advanced Xcode project management capabilities through Claude Code, enabling automated build management, scheme configuration, and project analysis.

## Setup Instructions

### 1. Start the Xcode MCP Server
```bash
# If you have the Xcode MCP server installed
xcode-mcp-server --port 3000

# Or if using a different Xcode MCP implementation
# Start the server on localhost:3000
```

### 2. Verify Server Connection
```bash
curl http://localhost:3000/health
```

### 3. Available MCP Capabilities (when server is running)
- **Project Analysis**: Analyze Xcode project structure and dependencies
- **Build Management**: Automated build, clean, and archive operations
- **Scheme Configuration**: Manage build schemes and configurations
- **Dependency Management**: CocoaPods and Swift Package Manager integration
- **Code Signing**: Certificate and provisioning profile management
- **Testing**: Run unit tests and UI tests through Xcode
- **Deployment**: App Store Connect integration and deployment

## Integration with Cosmo Project

### Project Configuration
Once the MCP server is running, you can:

1. **Analyze Project Structure**
   ```
   Ask Claude to analyze the Xcode project using MCP
   ```

2. **Build Management**
   ```
   Ask Claude to build, clean, or archive the Cosmo project
   ```

3. **Scheme Management**
   ```
   Configure Debug/Release schemes for different environments
   ```

4. **Testing Integration**
   ```
   Run automated tests through the MCP server
   ```

### Current Project Details (for MCP integration)
- **Workspace**: `ios/Cosmo.xcworkspace`
- **Project**: `ios/Cosmo.xcodeproj`
- **Target**: `Cosmo`
- **Bundle ID**: `com.anonymous.cosmo`
- **Platform**: iOS 12.0+
- **Architecture**: arm64, x86_64 (simulator)

### Environment Configuration
```bash
# Set up environment variables for MCP server
export XCODE_PROJECT_PATH="/Users/luffy/Desktop/group_dating/cosmo/ios/Cosmo.xcworkspace"
export XCODE_SCHEME="Cosmo"
export XCODE_CONFIGURATION="Debug"
```

## Benefits of MCP Integration

### Automated Workflows
- **CI/CD Integration**: Automated builds and deployments
- **Quality Assurance**: Automated testing and code analysis
- **Dependency Management**: Automated CocoaPods and SPM updates

### Advanced Features
- **Performance Analysis**: Build time optimization and memory profiling
- **Code Signing Automation**: Automated certificate management
- **Multi-target Builds**: Build for multiple devices and simulators simultaneously

## Without MCP Server (Current State)

The Cosmo project is fully functional without the MCP server:

### Manual Xcode Operations
```bash
# Open in Xcode
open ios/Cosmo.xcworkspace

# Build from command line
cd ios
xcodebuild -workspace Cosmo.xcworkspace -scheme Cosmo -configuration Debug -sdk iphonesimulator

# Run tests
xcodebuild test -workspace Cosmo.xcworkspace -scheme Cosmo -destination 'platform=iOS Simulator,name=iPhone 15 Pro'
```

### Direct CLI Usage
```bash
# Using Expo
npm run ios

# Using React Native CLI
npx react-native run-ios

# Clean build
npx react-native clean
```

## Troubleshooting MCP Integration

### Common Issues
1. **Server Connection**: Ensure MCP server is running on port 3000
2. **Project Path**: Verify workspace path is correctly configured
3. **Xcode Version**: Ensure compatible Xcode version is installed
4. **Permissions**: Check file system permissions for project directory

### Fallback Options
If MCP server is unavailable, all Xcode operations can be performed manually:
- Use Xcode GUI for project management
- Use command-line tools for builds and tests
- Use standard React Native/Expo CLI commands

## Next Steps

1. **Start MCP Server**: Get the Xcode MCP server running on localhost:3000
2. **Test Connection**: Verify Claude Code can communicate with the server
3. **Project Integration**: Let Claude analyze and manage the Cosmo project
4. **Automated Workflows**: Set up CI/CD pipelines using MCP capabilities

The Cosmo project is ready for MCP integration once the server is available!