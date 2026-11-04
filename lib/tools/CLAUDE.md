# Rules for lib/tools

- Tools return only the trimmed fields Claude needs (D-06). Never return full records, addresses, phone numbers, payment details or internal notes.
- verify_customer failures return only the generic result: {ok, reason: "no_match", attempts_left, next_step} or the locked shape (D-04). The detailed reason goes to the server log only.
