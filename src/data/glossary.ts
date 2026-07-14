export type GlossaryTerm = {
	aliases?: readonly string[];
	canonical: string;
	description: string;
	english: string;
};

export const GLOSSARY_TERMS: readonly GlossaryTerm[] = [
	{
		canonical: "エージェント",
		description: "オーケストレーターが各ステージで有効にする分野別専門家ペルソナ。",
		english: "agent",
	},
	{
		aliases: ["approval gate"],
		canonical: "承認ゲート",
		description: "各ステージ終端で承認・修正依頼・受け入れを選ぶ対話型チェックポイント。",
		english: "approval gate",
	},
	{
		aliases: ["Bolt"],
		canonical: "実行単位",
		description: "構築フェーズで 1 つ以上の作業ユニットをまとめて実行する単位。",
		english: "bolt",
	},
	{
		canonical: "コントリビューション",
		description: "プラグインが既存ステージへ加算的に差し込む構造変更や文章断片。",
		english: "contribution",
	},
	{
		canonical: "成果物",
		description: "ステージが生成し、インテントの記録ディレクトリへ保存する文書や出力。",
		english: "artifact",
	},
	{
		canonical: "監査証跡",
		description: "インテントの記録ディレクトリに蓄積される追記専用のイベント履歴。",
		english: "audit trail",
	},
	{
		canonical: "コンダクター",
		description: "エンジンの指示を受けてステージ実行や質問提示を行う `/aidlc` セッション本体。",
		english: "conductor",
	},
	{
		canonical: "ステージ",
		description: "AI-DLC の各フェーズで実行する具体的な作業単位。",
		english: "stage",
	},
	{
		canonical: "スウォーム",
		description: "複数の作業ユニットを並列に進めつつ、収束判定とマージを統制するコンストラクションの実行方式。",
		english: "swarm",
	},
	{
		canonical: "状態ファイル",
		description: "ワークフロー進捗、スコープ、再開情報を保持する `aidlc-state.md`。",
		english: "state file",
	},
	{
		canonical: "スコープ",
		description: "作業の広さや深さを定義する実行モード。",
		english: "scope",
	},
	{
		canonical: "センサー",
		description: "成果物や状態を検証する決定論的なチェック。",
		english: "sensor",
	},
	{
		canonical: "プラグイン",
		description: "任意導入で追加のステージ、センサー、コントリビューションなどを配布する拡張パッケージ。",
		english: "plugin",
	},
	{
		aliases: ["CLI ハーネス"],
		canonical: "ハーネス",
		description: "AI-DLC を各 CLI や IDE に投影する実行上の受け皿。",
		english: "harness",
	},
	{
		canonical: "マニフェスト",
		description: "ステージ、センサー、プラグインなどの宣言的な契約を記述する設定ファイル。",
		english: "manifest",
	},
	{
		canonical: "フェーズ",
		description: "ライフサイクルを構成する大区分で、複数のステージを束ねる。",
		english: "phase",
	},
	{
		canonical: "ワークフロー",
		description: "特定タスクに対して `/aidlc` から完了まで進む AI-DLC の 1 回の実行。",
		english: "workflow",
	},
	{
		canonical: "記録ディレクトリ",
		description: "1 つのインテントの状態、監査証跡、成果物を保持する `<record>/` ディレクトリ。",
		english: "record dir",
	},
	{
		canonical: "作業ユニット",
		description: "ステージ 2.7 で分解し、構築フェーズで独立して実装できる解決策の一部分。",
		english: "unit of work",
	},
	{
		canonical: "ウォーキングスケルトン",
		description: "構築フェーズ最初の Bolt であり、すべての統合点を通る最小のエンドツーエンド構成。",
		english: "walking skeleton",
	},
] as const;
