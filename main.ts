import {
	Plugin, PluginSettingTab,
	setIcon, Setting, App
} from 'obsidian';

// IMPORTANTE:
// TODOS OS SVGS DEVEM TER A COR DE PREENCHIMENTO currentColor PRA QUE AS CORES DELES SEJAM COERENTES COM OUTROS ÍCONES

interface Rule {
	iconType: 'lucide' | 'svg';
	id: string;
	match: string;
	svg?: string;
	highlight?: boolean;
}

interface GlyphureSettings {
	rules: Rule[];
}

const DEFAULT_SETTINGS: GlyphureSettings = {
	rules: [
		{
			iconType: 'lucide',
			id: 'link-2',
			match: '_anexos'
		}
	]
}

const DEFAULT_RULE: Rule = {
	iconType: 'lucide',
	id: 'folder',
	match: ''
}

export default class Glyphure extends Plugin {
	settings: GlyphureSettings;

	async onload() {
		/**
		 * carrega o plugin, inicializa os settings
		 * e prepara os observers necessários pra manter
		 * os ícones sincronizados com a file tree
		 */

		console.log('Loading Glyphure');

		await this.loadSettings();
		
		// adiciona a seção de settings do plugin
		this.addSettingTab(
			new GlyphureSettingsTab(this.app, this)
		);

		this.app.workspace.onLayoutReady(() => {
			// espera o layout estar pronto
			// antes de injetar os ícones pela primeira vez
			this.injectIcons();
			
			// adiciona um observer na file tree,
			// pra que qualquer mudança nela faça os ícones se atualizarem
			const fileTreeContainer = document.querySelector('.nav-files-container') as HTMLElement | null;
			if (fileTreeContainer) {
				const observer = new MutationObserver(() => {
					this.injectIcons();
				})
				
				observer.observe(fileTreeContainer, {
					childList: true, // detectar adição/remoção de elementos filhos
					subtree: true    // observar toda a hierarquia interna também
				});
			}
		});
	}
	
	async loadSettings() {
		/**
		 * carrega os settings salvos do plugin
		 * e faz merge com os valores padrão
		 *
		 * isso garante que novas propriedades adicionadas
		 * em updates futuras continuem existindo mesmo
		 * em settings antigos
		 */

		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		/**
		 * salva os settings atuais no disco
		*/

		// não precisa serializar pq a api do obsidian já faz isso
		await this.saveData(this.settings);
	}

	async injectIcons() {
		/**
		 * percorre todos os diretórios visíveis na file tree
		 * e injeta ícones customizados com base nas regras definidas
		 */

		// TODO: fazer rodar ao save e load settings também
		const directories = Array.from(
			document.querySelectorAll('.nav-folder-title')
		);

		for (const d of directories) {
			// obter o nome do diretório (sem espaços ou uma string vazia)
			const dirName = d.textContent?.trim() || '';

			// TODO: usar isso pra ícones dinâmicos depois
			// obter o estado atual dele, se é fechado ou aberto
			// const folderContainer = d.closest('.nav-folder');
			// const isCollapsed = folderContainer?.classList.contains('is-collapsed');
			
			// não faz nada se o elemento já tiver um ícone
			const iconAlreadyAdded = d.querySelector(`.glyphure-icon`);
			if (iconAlreadyAdded) {
				continue;
			}
			
			// por padrão, usa um ícone x
			// e se alguma regra corresponder, troca o ícone padrão
			let rule = DEFAULT_RULE;
			
			for (const r of this.settings.rules) {
				if (r.match == dirName) {
					rule = r;
					break;
				}
			}

			// garantir que o id seja válido pra api do obsidian/lucide
			let iconId = rule.id;
			
			// TODO: fazer isso com um observer que escuta quais pastas
			// foram abertas e quais foram fechadas
			// if (iconId == 'folder') {
			// 	// mostrar um ícone diferentes pra pastas que não têm
			// 	// nenhum ícone custom e estão abertas
			// 	iconId = isCollapsed ? 'folder' : 'folder-open';
			// }

			if (!iconId.startsWith('lucide-')) {
				iconId = 'lucide-' + iconId;
			}
			
			// criar a div do ícone e adicionar as classes html
			const iconDiv = document.createElement('div');
			iconDiv.classList.add('glyphure-icon');

			// aplicar classes htmls necessárias
			if (rule.highlight) {
				iconDiv.classList.add('glyphure-highlighted');
			}
			
			// aplicar o ícone de modo diferente dependendo do tipo dele
			if (rule.iconType == 'lucide') {
				setIcon(iconDiv, iconId);	
			} else if (rule.iconType == 'svg' ) {
				let svg = rule.svg;
				
				if (svg) {
					// isso espera que o conteúdo do svg seja igual o de uma tag html
					iconDiv.innerHTML = svg;
				} else {
					// fallback pra indicar que o tipo é svg
					// mas nenhum svg foi passado
					setIcon(iconDiv, 'x');
					iconDiv.classList.add('glyphure-error');
				}
			}

			d.prepend(iconDiv); // adiciona no começo/antes do elemento da file tree
		}
	}
}

class GlyphureSettingsTab extends PluginSettingTab {
	plugin: Glyphure;
	
	// TODO: documentação
	constructor(app: App, plugin: Glyphure) {
		/**
		 * cria a tab de settings do plugin
		 * e mantém referência da instância principal
		 *
		 * args:
		 *		app:
		 *			instância principal do obsidian
		 *
		 *		plugin:
		 *			instância do plugin glyphure
		*/
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		/**
		 * renderiza toda a interface da tab de settings
		 *
		 * cada regra cria uma seção própria com inputs
		 * pra editar os valores em tempo real
		 */

		const { containerEl } = this; // referência pro container principal da tab
		containerEl.empty(); // limpar os elementos antes de recarregar
		
		this.plugin.settings.rules.forEach((rule, index) => {
			// seção visual individual da regra
			const section = containerEl.createDiv('glyphure-rule');
			
			// seletor do tipo de ícone
			new Setting(section)
			.setName('Type')
			.setDesc('Choose whether this rule uses a Lucide icon or a custom SVG.')
			.addDropdown(dropdown => {
				dropdown
					.addOption('lucide', 'Lucide')
					.addOption('svg', 'Custom SVG')
					
					// carregar o valor atual salvo
					.setValue(rule.iconType)
					
					.onChange(async value => {
						rule.iconType = value as 'lucide' | 'svg'; // atualizar o valor da regra
						
						await this.plugin.saveSettings();          // persistir no disco
					})
			})

			// nome da pasta que será comparado
			new Setting(section)
				.setName('Match')
				.setDesc('Folder name that triggers this rule.')
				.addText(text => {
					text.setValue(rule.match);

					text.onChange(async value => {
						rule.match =  value;
						await this.plugin.saveSettings();
					});
				});
			
			// id do ícone lucide
			new Setting(section)
				.setName('ID')
				.setDesc('Lucide icon name to use when this rule matches.')
				.addText(text => {
					text.setValue(rule.id)

					text.onChange(async value => {
						rule.id = value;
						await this.plugin.saveSettings();
					});
				});
			
			// svg custom bruto
			new Setting(section)
			.setName('SVG')
			.setDesc('Raw SVG markup used when the icon type is set to Custom SVG.')
			.addTextArea(text => {
				text.setValue(rule.svg ?? '')

				text.onChange(async value => {
					rule.svg = value;
					await this.plugin.saveSettings();
				});
			});
			
			// destacar visualmente o ícone ou não
			new Setting(section)
				.setName('Highlighted')
				.setDesc('Apply a highlighted visual style to matching folders.')
				.addToggle((toggle) => {
					toggle
						.setValue(rule.highlight ?? false)

						.onChange(async value => {
							rule.highlight = value;
							await this.plugin.saveSettings();
						});
				});
			
			new Setting(section)
				.setName('Remove rule')
				.setDesc('Removes this rule')
				.addButton(button => {
					button
						.setButtonText('Remove rule')
						.setWarning()
						.onClick(async () => {
							this.plugin.settings.rules.splice(index, 1);
							
							await this.plugin.saveSettings();
							this.display();
						})
				});
		});

		new Setting(containerEl)
			.addButton(button => {
				button
					.setButtonText('New rule')
					.setCta()
					.onClick(async () => {
						// adicionar uma regra nova sem nenhum valor
						this.plugin.settings.rules.push({
							match: '',
							iconType: 'lucide',
							id: ''
						});
						
						await this.plugin.saveSettings(); // salvar no disco
						this.display(); // atualizar a tab pra mostrar a regra nova
					});
			})
	}
}