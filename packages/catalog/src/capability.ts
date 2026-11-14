import type { CapabilityProfileData } from "../../protocol/src/capability";

/** Fictional training example; callers supply their own rubric and evidence. */
export const insuranceCapabilityExample: CapabilityProfileData = {
  title: "能力画像",
  subjectId: "agent-chen",
  subjectName: "陈晓宁",
  subtitle: "个险代理人 · 虚构档案",
  sampleData: true,
  modelVersion: "1.0",
  dimensions: [
    {
      id: "knowledge",
      label: "专业知识",
      description: "理解保险责任、责任免除、核保要求与理赔流程，并能准确解释。",
      evidence: "产品知识测评、条款讲解演练、核保与理赔案例。",
    },
    {
      id: "needs",
      label: "需求分析",
      description: "了解家庭责任、已有保障与预算，识别保障缺口并排列优先级。",
      evidence: "需求访谈记录、家庭保障分析案例、预算匹配练习。",
    },
    {
      id: "planning",
      label: "方案规划",
      description: "围绕实际需求组合保障，清楚说明方案取舍、限制与费用。",
      evidence: "方案评审、保障缺口覆盖情况、方案解释演练。",
    },
    {
      id: "communication",
      label: "沟通表达",
      description: "倾听客户顾虑，使用清楚、准确的语言说明保障与限制。",
      evidence: "模拟面谈、客户理解确认、异议处理情景练习。",
    },
    {
      id: "relationship",
      label: "客户经营",
      description: "持续开展保单检视、续期提醒和理赔协助，维护客户服务关系。",
      evidence: "服务记录、保单检视案例、续期与理赔协助练习。",
    },
    {
      id: "compliance",
      label: "合规执业",
      description: "遵守适用的销售规范，完成必要告知、隐私保护与过程留痕。",
      evidence: "告知与留痕检查、隐私保护测评、销售情景质检。",
    },
  ],
  scores: {
    knowledge: 82,
    needs: 76,
    planning: 68,
    communication: 88,
    relationship: 72,
    compliance: 94,
  },
  scenarios: [
    {
      id: "consultant",
      label: "顾问进阶",
      targets: {
        knowledge: 85,
        needs: 85,
        planning: 85,
        communication: 85,
        relationship: 85,
        compliance: 95,
      },
    },
    {
      id: "newcomer",
      label: "新人培养",
      targets: {
        knowledge: 75,
        needs: 70,
        planning: 65,
        communication: 75,
        relationship: 65,
        compliance: 90,
      },
    },
    {
      id: "service",
      label: "续期服务",
      targets: {
        knowledge: 80,
        needs: 80,
        planning: 75,
        communication: 85,
        relationship: 90,
        compliance: 95,
      },
    },
  ],
  scenarioId: "consultant",
  selectedDimensionId: "planning",
  fillOpacity: 12,
  showDimensions: true,
  showDetails: true,
};
