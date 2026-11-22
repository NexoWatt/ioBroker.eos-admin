/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Gemeinsamer Browser-Typvertrag für den optionalen Admin-Proxy-Bootstrap.
 * Wirkung: Ausschließlich Typdeklarationen; erzeugt weder Browser-JavaScript noch
 * einen Exportmarker in bestehenden klassischen Scriptdateien. Der Vertrag steht
 * bei Modul- und Scriptprüfung sowie in manuell typisierten Spiegeln zur Verfügung.
 * Die lokalen identischen Bootstrap-Interfaces werden bei klassischer Scriptprüfung
 * zusammengeführt; Modulprüfung verwendet diese globale Window-Erweiterung.
 * Sicherheitsgrenze: Die Existenz dieses Typs schaltet keine Zugriffsrechte frei.
 */
export {};

declare global {
  interface NexoWattRuntimeBase {
    readonly isProxy: boolean;
    readonly instance: string | null;
    url(value: string): string;
    pathname(): string;
    adminBase(): string;
  }
  interface Window {
    NW_RUNTIME?: NexoWattRuntimeBase;
  }
}
