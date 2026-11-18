# Java HTTP integration / Java HTTP 接入

This is a Java 21 HTTP client of the Node Host contract, not a Java Gateway or MCP SDK.
这是 Node Host 契约的 Java 21 HTTP 客户端，不是 Java Gateway/MCP SDK。

Start `pnpm mcp:dev`, then from repository root / 先启动本地服务，再在仓库根目录执行：

```sh
MCP_JAVA_HOME=/path/to/jdk21 pnpm mcp:java
# Optional URL, configured server ID and tool / 可选服务地址与工具：
MCP_JAVA_HOME=/path/to/jdk21 pnpm mcp:java http://127.0.0.1:3001/api/v1/mcp expense-demo expense_dashboard
```

The runner downloads pinned Gson 2.13.2 from Maven Central, verifies SHA-256, compiles and runs the source. Maven users may run `mvn compile dependency:copy-dependencies`, then run the main class with target/classes and dependency jars on the classpath. No JDK installation or system Java changes are performed by the runner.

脚本下载并校验固定 Gson 2.13.2，编译、运行真实源码；不会安装或修改系统 Java。也可用 Maven pom 处理依赖。

Flow: servers → connection → create App (one tool execution) → snapshot/events → cleanup. While the App is live, return its appId and user-scoped connection capability to your authorized React host; do not call create again to render. This command-line example deletes the App before exiting. Server credentials never go to Preview. For an Agent call already executed on the same connection, trusted orchestration uses `attach`; no browser attach endpoint is exposed.

流程：发现服务、连接、创建 App（执行一次工具）、读取快照/事件、清理。业务接入时在实例有效期间将 appId 和当前用户的连接能力传给 React；本命令行示例退出前主动销毁。对于编排器已执行的同连接调用，应使用后端 attach，浏览器不开放该接口。

Full contract / 完整契约：[中文](../../../docs/developer/mcp-apps-host.md)、[English](../../../docs/developer/mcp-apps-host.en-US.md)。
