import { App, ButtonComponent, Modal } from "obsidian";

/** "Are you sure?" dialog; `onConfirm` runs only if the warning button is pressed. */
export class ConfirmModal extends Modal {
	constructor(
		app: App,
		private title: string,
		private message: string,
		private confirmText: string,
		private onConfirm: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.titleEl.setText(this.title);
		this.contentEl.createEl("p", { text: this.message });
		const buttons = this.contentEl.createDiv("modal-button-container");
		new ButtonComponent(buttons).setButtonText("Cancel").onClick(() => this.close());
		new ButtonComponent(buttons)
			.setButtonText(this.confirmText)
			.setWarning()
			.onClick(() => {
				this.close();
				this.onConfirm();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
