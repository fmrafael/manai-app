'use client';

import { supabase } from '@/lib/supabaseClient';

export default function Teste() {
  const handleTestInsert = async () => {
    const { data, error } = await supabase
      .from('subscribers')
      .insert([{ email: 'testesucesso@teste.com', status: 'trial' }]);

    if (error) {
      console.error('Erro ao inserir:', error);
      alert('Erro ao inserir: ' + error.message);
    } else {
      console.log('Inserido com sucesso:', data);
      alert('Inserido com sucesso!');
    }
  };

  return (
    <div>
      <button onClick={handleTestInsert}>Testar INSERT no Supabase</button>
    </div>
  );
}
