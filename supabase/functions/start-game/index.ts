import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    const { room_id } = await req.json()

    if (!room_id) {
      throw new Error('room_id is required')
    }

    // 1. Get room details
    const { data: room, error: roomError } = await supabaseClient
      .from('rooms')
      .select('*')
      .eq('id', room_id)
      .single()

    if (roomError || !room) throw new Error('Room not found')

    // 2. Fetch random questions
    let query = supabaseClient.from('questions').select('id')
    
    if (room.category !== 'mixed') {
      query = query.eq('category', room.category)
    }
    
    const { data: questions, error: questionsError } = await query
    
    if (questionsError || !questions || questions.length === 0) {
      throw new Error('No questions found for the selected category')
    }

    // Shuffle and pick N questions
    const shuffled = questions.sort(() => 0.5 - Math.random())
    const selected = shuffled.slice(0, room.question_count)

    // 3. Insert into room_questions
    const roomQuestionsToInsert = selected.map((q, index) => ({
      room_id,
      question_id: q.id,
      question_order: index
    }))

    const { error: insertError } = await supabaseClient
      .from('room_questions')
      .insert(roomQuestionsToInsert)

    if (insertError) throw insertError

    // 4. Update room status to 'active'
    const { error: updateError } = await supabaseClient
      .from('rooms')
      .update({ status: 'active', current_question_index: 0 })
      .eq('id', room_id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
