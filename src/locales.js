const FINDING_TRANSLATIONS = {
  "secret-api-key": {
    title: "可能提交了敏感密钥",
    message: "新增代码看起来像凭据材料。如果是真实密钥，请立即轮换并移动到密钥管理系统。",
  },
  "secret-private-key": {
    title: "可能提交了私钥材料",
    message: "新增代码包含私钥内容。如果是真实私钥，请立即吊销并重新签发。",
  },
  "secret-aws-access-key": {
    title: "可能提交了 AWS 访问密钥",
    message: "新增代码包含 AWS access key。请立即轮换密钥并改用安全的密钥管理方式。",
  },
  "database-migration": {
    title: "数据库迁移发生变化",
    message: "请检查发布、回滚和向后兼容性。如果新旧应用版本会同时运行，请补充数据安全说明。",
  },
  "dependency-change": {
    title: "依赖关系发生变化",
    message: "合并前请检查许可证、供应链风险、锁文件和兼容性影响。",
  },
  "missing-tests": {
    title: "源码变更缺少测试",
    message: "这个 PR 修改了源码，但 diff 中没有检测到测试文件。",
  },
  "public-api-change": {
    title: "公共 API 表面发生变化",
    message: "这个文件的导出内容发生变化。请确认下游兼容性，并在需要时更新文档。",
  },
  "large-change": {
    title: "单文件变更较大",
    message: "这个文件变更行数较多。请考虑拆分 PR 或补充重点 review 说明。",
  },
  "github-actions-broad-permissions": {
    title: "GitHub Actions 权限过宽",
    message: "工作流授予了过宽的写权限。请为具体 job 使用最小权限。",
    recommendation: "将 write-all 或仓库级写权限替换为工作流实际需要的最小权限。",
  },
  "github-actions-pull-request-target": {
    title: "新增了 pull_request_target 触发器",
    message: "pull_request_target 会使用更高权限的 token 运行，和不可信 PR 代码结合时有较高风险。",
    recommendation: "尽量使用 pull_request；如果必须使用，请避免用高权限凭据 checkout 或运行不可信分支代码。",
  },
  "github-actions-unpinned-action": {
    title: "GitHub Action 未固定到 commit SHA",
    message: "第三方 Action 如果固定到 tag 或 branch，后续可能在未 review 的情况下变化。",
    recommendation: "将外部 Action 固定到完整 commit SHA，并有意识地 review 更新。",
  },
  "dockerfile-root-user": {
    title: "Docker 镜像以 root 用户运行",
    message: "Dockerfile 显式切换到 root 用户，会扩大容器逃逸或漏洞利用的影响。",
    recommendation: "除非确实需要 root，否则创建并使用非 root 用户运行。",
  },
  "dockerfile-curl-shell": {
    title: "Dockerfile 执行远程安装脚本",
    message: "把远程脚本直接 pipe 到 shell 会降低构建可审计性，并增加上游被攻陷时的风险。",
    recommendation: "请下载固定版本的产物，校验 checksum 或签名后再执行。",
  },
  "kubernetes-privileged-container": {
    title: "Kubernetes 启用了特权容器",
    message: "特权容器会绕过许多容器隔离边界。",
    recommendation: "移除 privileged 模式，只授予工作负载确实需要的能力。",
  },
  "kubernetes-host-namespace": {
    title: "Kubernetes 启用了宿主机命名空间访问",
    message: "宿主机命名空间访问可能暴露节点网络或进程隔离边界。",
    recommendation: "除非这是受控的节点代理，否则避免启用 hostNetwork、hostPID 或 hostIPC。",
  },
  "terraform-public-ingress": {
    title: "Terraform 安全组允许公网入站",
    message: "安全组规则允许来自公网的流量。",
    recommendation: "将 CIDR 限制到可信网络，并说明任何有意的公网暴露。",
  },
  "terraform-iam-wildcard": {
    title: "Terraform IAM 使用了通配权限",
    message: "IAM action 或 resource 使用通配符可能授予超出预期的权限。",
    recommendation: "将 IAM policy 限制到明确的 action 和 resource。",
  },
  "sql-destructive-migration": {
    title: "破坏性 SQL 迁移",
    message: "这个迁移可能删除 schema 或数据。",
    recommendation: "合并前请确认备份、回滚策略和分阶段发布兼容性。",
  },
  "npm-install-script": {
    title: "新增了 npm 安装生命周期脚本",
    message: "安装生命周期脚本会在依赖安装时执行任意命令。",
    recommendation: "尽量避免 install 脚本；如果必须使用，请说明它为什么必要且安全。",
  },
  "ai-unavailable": {
    title: "AI 审查不可用",
    message: "AI 审查已跳过：缺少模型供应商凭据。",
    recommendation: "配置受支持的模型供应商密钥，或使用 --no-ai 运行。",
  },
};

const UI_TRANSLATIONS = {
  "zh-CN": {
    reportTitle: "PR Sentinel 报告",
    scannedFiles(count) {
      return `已扫描 ${count} 个变更文件。`;
    },
    findingsSummary(summary) {
      return `发现项：共 ${summary.total} 个，high ${summary.high} 个，medium ${summary.medium} 个，low ${summary.low} 个，info ${summary.info} 个。`;
    },
    noFindings: "未检测到风险信号。",
    table: {
      severity: "严重级别",
      rule: "规则",
      location: "位置",
      finding: "发现项",
    },
    recommendation: "建议",
  },
};

export function normalizeLocale(locale) {
  const normalized = String(locale ?? "en").toLowerCase();
  return normalized === "zh-cn" || normalized === "zh_cn" ? "zh-CN" : "en";
}

export function localizeResult(result, locale) {
  if (normalizeLocale(locale) !== "zh-CN") return result;

  return {
    ...result,
    locale: "zh-CN",
    findings: result.findings.map((finding) => localizeFinding(finding, "zh-CN")),
  };
}

export function localizeFinding(finding, locale) {
  if (normalizeLocale(locale) !== "zh-CN") return finding;
  const translation = FINDING_TRANSLATIONS[finding.ruleId];

  if (!translation) return finding;

  return {
    ...finding,
    title: translation.title ?? finding.title,
    message: translation.message ?? finding.message,
    recommendation: translation.recommendation ?? finding.recommendation,
  };
}

export function getUiText(locale) {
  return UI_TRANSLATIONS[normalizeLocale(locale)] ?? null;
}
