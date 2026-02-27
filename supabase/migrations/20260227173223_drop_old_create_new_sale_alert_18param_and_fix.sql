/*
  # Drop old 18-param create_new_sale_alert_with_email function

  ## Problem
  Two overloaded versions of create_new_sale_alert_with_email exist:
  - 18-param version (old, without autoriza_documentos) - causes ambiguity and was
    receiving autoriza_documentos mapped to the wrong parameter
  - 19-param version (new, with autoriza_documentos) - correct version

  The trigger passes 18 positional arguments including autoriza_documentos as the
  last one. PostgreSQL resolves this to the 18-param function where tier gets
  the value intended for autoriza_documentos. The email body in the old function
  also does not pass autoriza_documentos to the HTTP call.

  ## Fix
  Drop the old 18-param function so only the correct 19-param version remains.
*/

DROP FUNCTION IF EXISTS create_new_sale_alert_with_email(
  uuid, text, text, uuid, text, uuid, uuid, text, text, text, uuid,
  jsonb, text, text, text, text, text, text
);
