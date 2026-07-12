/** Artifact-backed input flags accepted by `harness next`. */
export const NEXT_ARTIFACT_ARG_SPECS = [
	{
		flag: "--phase-exit",
		field: "phaseExitPath",
		error: "phase_exit_missing",
		nextAction: "Pass a HePhaseExit/v1 artifact path, or omit --phase-exit.",
	},
	{
		flag: "--runtime-card",
		field: "runtimeCardPath",
		error: "runtime_card_missing",
		nextAction: "Pass a runtime-card/v1 artifact path, or omit --runtime-card.",
	},
	{
		flag: "--pr-closeout",
		field: "prCloseoutPath",
		error: "pr_closeout_missing",
		nextAction: "Pass a pr-closeout/v1 artifact path, or omit --pr-closeout.",
	},
	{
		flag: "--fitness-report",
		field: "fitnessReportPath",
		error: "fitness_report_missing",
		nextAction:
			"Pass a harness-fitness/v1 artifact path, or omit --fitness-report.",
	},
	{
		flag: "--synaipse-transition",
		field: "synaipseTransitionPath",
		error: "synaipse_transition_missing",
		nextAction:
			"Pass a synaipse-transition/v1 artifact path, or omit --synaipse-transition.",
	},
] as const;
