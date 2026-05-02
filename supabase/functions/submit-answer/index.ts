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

    const { room_id, player_id, question_id, answer_given, time_taken_ms } = await req.json()

    if (!room_id || !player_id || !question_id || !answer_given) {
      throw new Error('Missing required fields')
    }

    // 1. Get the correct answer
    const { data: question, error: qError } = await supabaseClient
      .from('questions')
      .select('correct_answer')
      .eq('id', question_id)
      .single()

    if (qError || !question) throw new Error('Question not found')

    const is_correct = question.correct_answer === answer_given

    // 2. Insert the answer
    const { error: insertError } = await supabaseClient
      .from('answers')
      .insert({
        room_id,
        player_id,
        question_id,
        answer_given,
        is_correct,
        time_taken_ms
      })

    if (insertError) {
      // If they already answered, maybe just ignore or return error. We'll throw for now.
      throw insertError
    }

    // 3. Update player score if correct
    let scoreEarned = 0
    if (is_correct) {
      // Base score 10, minus 1 point per second taken (min 1 point)
      const secondsTaken = Math.floor(time_taken_ms / 1000)
      scoreEarned = Math.max(1, 10 - secondsTaken)

      // Fetch current score and update
      const { data: player, error: pError } = await supabaseClient
        .from('players')
        .select('score')
        .eq('id', player_id)
        .single()
        
      if (!pError && player) {
        await supabaseClient
          .from('players')
          .update({ score: player.score + scoreEarned })
          .eq('id', player_id)
      }
    }

    return new Response(
      JSON.stringify({ success: true, is_correct, score_earned: scoreEarned }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
