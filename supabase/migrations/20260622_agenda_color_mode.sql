-- Modo de cor da agenda: colorir os eventos por profissional (padrão) ou por serviço.
alter table salons
  add column if not exists agenda_color_mode text not null default 'professional'
  check (agenda_color_mode in ('professional', 'service'));
