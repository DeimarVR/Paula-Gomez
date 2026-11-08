'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Reveal } from './Reveal';

interface AccordionItem {
  question: string;
  answer: string;
}

interface AccordionProps {
  items: readonly AccordionItem[];
}

/** Preguntas frecuentes. Solo una abierta a la vez. */
export function Accordion({ items }: AccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3.5">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;

        return (
          <Reveal key={item.question} delay={index * 70}>
          <div
            className="rounded-[1.15rem] bg-surface px-6 py-5 shadow-soft transition-shadow duration-200 hover:shadow-lift"
          >
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="flex w-full items-center justify-between gap-6 text-left transition-colors hover:text-brand-700"
              >
                <span className="font-display text-xl font-bold leading-snug sm:text-[1.35rem]">
                  {item.question}
                </span>
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 transition-transform duration-300 ${
                    isOpen ? 'rotate-45 bg-brand-700 text-white' : ''
                  }`}
                >
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="pr-10 pt-3.5"
            >
              <p className="max-w-[64ch] leading-relaxed text-muted">{item.answer}</p>
            </div>
          </div>
          </Reveal>
        );
      })}
    </div>
  );
}
