import { App, Modal, Setting } from "obsidian";

/** A yes/no dialog for actions that can't be undone. */
export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private heading: string,
		private body: string,
		private confirmText: string,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.heading);
		this.contentEl.createEl("p", { text: this.body });
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(this.confirmText)
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
