# 🎉 cors-diagnoser v1.0.0 - Initial Release

We're excited to announce the first stable release of **cors-diagnoser** - an automatic CORS error diagnostic tool for Express backend and browser frontend!

## 🚀 What is cors-diagnoser?

cors-diagnoser helps developers quickly identify and fix CORS (Cross-Origin Resource Sharing) issues by providing:

- **Automatic error detection** in real-time
- **Clear explanations** of what's wrong
- **Ready-to-use code examples** to fix issues
- **Security recommendations** for production environments
- **Pattern matching** for 10+ common CORS errors

## ✨ Key Features

### Backend (Express)

- 🔧 **Express Middleware**: Drop-in middleware that automatically diagnoses CORS issues
- 📊 **Error History**: Track recurring CORS problems during development
- 🔍 **Header Analysis**: Detailed inspection of request/response headers
- ⚙️ **Configuration Testing**: Compare and validate CORS configurations
- 🎯 **Origin Testing**: Test if specific origins would be allowed

### Frontend (Browser)

- 🌐 **Browser Listener**: Capture CORS errors that occur in the browser
- 📝 **Detailed Diagnostics**: Get possible causes and recommendations
- 🔗 **Custom Handlers**: Integrate with your error tracking service
- 📈 **Error Aggregation**: Collect and analyze CORS errors over time

### Core Features

- 🎯 **10+ Pattern Detection**: Automatically identifies common CORS error patterns
- 🔒 **Security Advisor**: Validates configurations for security issues
- 💡 **Code Generation**: Provides ready-to-use code snippets
- 🎨 **Colored Output**: Beautiful, formatted terminal logs
- 📚 **TypeScript Support**: Full type definitions included

## 📦 Installation

```bash
npm install cors-diagnoser
```

## 🔥 Quick Start

### Backend Example

```typescript
import express from "express";
import { corsDiagnoser } from "cors-diagnoser";

const app = express();

// Add CORS diagnoser before your routes
app.use(corsDiagnoser({ verbose: true }));

app.get("/api/users", (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);
```

### Frontend Example

```typescript
import { listenCorsErrors } from "cors-diagnoser";

// Start listening for CORS errors
listenCorsErrors({
  verbose: true,
  customHandler: (error) => {
    console.log("CORS Error:", error.message);
    console.log("Possible causes:", error.possibleCauses);
  },
});
```

## 🎯 Common Patterns Detected

1. **wildcard-credentials-conflict**: `*` origin with credentials enabled
2. **multiple-origins-misconfiguration**: Multiple origins needed but only one string configured
3. **preflight-only-failure**: Preflight fails but simple request would work
4. **custom-headers-not-allowed**: Custom headers sent but not allowed
5. **missing-allow-origin**: Access-Control-Allow-Origin header missing
6. **missing-allow-headers**: Access-Control-Allow-Headers missing in preflight
7. **missing-allow-methods**: Access-Control-Allow-Methods missing in preflight
8. **credentials-mismatch**: Frontend sends credentials but backend doesn't allow
9. **origin-null-blocked**: Origin "null" is being blocked
10. **port-mismatch**: Same domain but different port blocked

## 📚 Documentation

Full documentation is available in the [README](https://github.com/dominiquekossi/cors-diagnoser#readme) including:

- Complete API reference
- TypeScript interfaces
- Configuration options
- Multiple usage examples
- Security best practices

## 🔗 Links

- **NPM Package**: https://www.npmjs.com/package/cors-diagnoser
- **GitHub Repository**: https://github.com/dominiquekossi/cors-diagnoser
- **Documentation**: https://github.com/dominiquekossi/cors-diagnoser#readme
- **Issues**: https://github.com/dominiquekossi/cors-diagnoser/issues

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT © Dominique Kossi

---

**Made with ❤️ by developers, for developers**

If this package helps you, consider giving it a ⭐ on GitHub!
